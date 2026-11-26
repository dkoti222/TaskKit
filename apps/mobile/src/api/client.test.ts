import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

// The refresh interceptor, against a fake server (an axios adapter, no network).
jest.mock('@/store/token-storage', () => ({
  loadTokens: jest.fn(async () => null),
  saveTokens: jest.fn(async () => undefined),
  clearTokens: jest.fn(async () => undefined),
}));

type Handler = (config: InternalAxiosRequestConfig) => { status: number; data?: unknown };
let handler: Handler;
const calls: { url: string; auth?: string }[] = [];

// Every axios instance created after this uses the fake server (client.ts creates two).
const fakeServer: AxiosAdapter = async (config) => {
  calls.push({ url: config.url ?? '', auth: config.headers?.Authorization as string | undefined });
  const { status, data } = handler(config);
  const response = { data, status, statusText: String(status), headers: {}, config };
  if (status >= 400) {
    throw new AxiosError(`HTTP ${status}`, String(status), config, null, response);
  }
  return response;
};

// client.ts creates its axios instances when it's loaded, and `import`s are hoisted above any
// code. So the fake server goes in first, then the client is loaded with require().
let api: typeof import('./client').api;
let useSession: typeof import('@/store/session').useSession;
let SESSION_EXPIRED: typeof import('@/store/session').SESSION_EXPIRED;
beforeAll(() => {
  axios.defaults.adapter = fakeServer;
  /* eslint-disable @typescript-eslint/no-require-imports -- must load after the fake server */
  ({ api } = require('./client'));
  ({ useSession, SESSION_EXPIRED } = require('@/store/session'));
  /* eslint-enable @typescript-eslint/no-require-imports */
});

const signIn = () =>
  useSession.setState({ status: 'signedIn', accessToken: 'old-access', refreshToken: 'old-refresh', notice: null });

describe('api client: refresh on 401', () => {
  beforeEach(() => {
    calls.length = 0;
    signIn();
  });

  it('sends the access token', async () => {
    handler = () => ({ status: 200, data: { ok: true } });
    await api.get('/me');
    expect(calls[0].auth).toBe('Bearer old-access');
  });

  it('parallel 401s share ONE refresh, then each request is retried with the new token', async () => {
    let refreshes = 0;
    handler = (config) => {
      if (config.url === '/auth/refresh') {
        refreshes++;
        return { status: 200, data: { accessToken: 'new-access', refreshToken: 'new-refresh' } };
      }
      const auth = config.headers?.Authorization;
      return auth === 'Bearer new-access' ? { status: 200, data: { url: config.url } } : { status: 401 };
    };

    const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);

    expect(refreshes).toBe(1);
    expect(results.map((r) => r.data.url)).toEqual(['/a', '/b', '/c']);
    expect(useSession.getState()).toMatchObject({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    // The refresh sent the old refresh token, and retries used the new access token.
    const retries = calls.filter((c) => c.url !== '/auth/refresh' && c.auth === 'Bearer new-access');
    expect(retries).toHaveLength(3);
  });

  it('retries only once: a second 401 is returned to the caller', async () => {
    handler = (config) =>
      config.url === '/auth/refresh'
        ? { status: 200, data: { accessToken: 'new-access', refreshToken: 'new-refresh' } }
        : { status: 401 };
    await expect(api.get('/still-401')).rejects.toMatchObject({ response: { status: 401 } });
    expect(calls.filter((c) => c.url === '/still-401')).toHaveLength(2);
  });

  it('a rejected refresh logs out with "Your session expired"', async () => {
    handler = (config) => (config.url === '/auth/refresh' ? { status: 401 } : { status: 401 });
    await expect(api.get('/me')).rejects.toMatchObject({ response: { status: 401 } });
    expect(useSession.getState()).toMatchObject({ status: 'signedOut', notice: SESSION_EXPIRED });
  });

  it('a network error during refresh keeps the session (offline is not logged out)', async () => {
    handler = (config) => {
      if (config.url === '/auth/refresh') throw new AxiosError('Network Error', 'ERR_NETWORK', config);
      return { status: 401 };
    };
    await expect(api.get('/me')).rejects.toMatchObject({ code: 'ERR_NETWORK' });
    expect(useSession.getState().status).toBe('signedIn');
  });

  it('does not try to refresh after a 401 from /auth routes (wrong password)', async () => {
    handler = () => ({ status: 401 });
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ response: { status: 401 } });
    expect(calls.some((c) => c.url === '/auth/refresh')).toBe(false);
  });
});
