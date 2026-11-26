import { SESSION_EXPIRED, useSession } from './session';

// SecureStore is native; the session store only talks to it through token-storage.
const saved: { tokens: { accessToken: string; refreshToken: string } | null } = { tokens: null };
jest.mock('./token-storage', () => ({
  loadTokens: jest.fn(async () => saved.tokens),
  saveTokens: jest.fn(async (t: { accessToken: string; refreshToken: string }) => {
    saved.tokens = t;
  }),
  clearTokens: jest.fn(async () => {
    saved.tokens = null;
  }),
}));

const reset = () =>
  useSession.setState({ status: 'loading', accessToken: null, refreshToken: null, notice: null });

describe('session store', () => {
  beforeEach(() => {
    saved.tokens = null;
    reset();
  });

  it('hydrate: no saved tokens → signed out', async () => {
    await useSession.getState().hydrate();
    expect(useSession.getState().status).toBe('signedOut');
  });

  it('hydrate: saved tokens → signed in with them', async () => {
    saved.tokens = { accessToken: 'a1', refreshToken: 'r1' };
    await useSession.getState().hydrate();
    expect(useSession.getState()).toMatchObject({ status: 'signedIn', accessToken: 'a1', refreshToken: 'r1' });
  });

  it('signIn saves the pair (SecureStore) and clears any old notice', async () => {
    useSession.setState({ notice: SESSION_EXPIRED });
    await useSession.getState().signIn({ accessToken: 'a2', refreshToken: 'r2' });
    expect(saved.tokens).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
    expect(useSession.getState()).toMatchObject({ status: 'signedIn', notice: null });
  });

  it('setTokens saves a rotated pair before using it', async () => {
    await useSession.getState().signIn({ accessToken: 'a2', refreshToken: 'r2' });
    await useSession.getState().setTokens({ accessToken: 'a3', refreshToken: 'r3' });
    expect(saved.tokens).toEqual({ accessToken: 'a3', refreshToken: 'r3' });
    expect(useSession.getState().refreshToken).toBe('r3');
  });

  it('signOut forgets the tokens and can leave a message for the Log in screen', async () => {
    await useSession.getState().signIn({ accessToken: 'a', refreshToken: 'r' });
    await useSession.getState().signOut(SESSION_EXPIRED);
    expect(saved.tokens).toBeNull();
    expect(useSession.getState()).toMatchObject({
      status: 'signedOut',
      accessToken: null,
      refreshToken: null,
      notice: SESSION_EXPIRED,
    });
  });
});
