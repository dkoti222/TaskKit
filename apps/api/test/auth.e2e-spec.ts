import { createTestApp, type TestApp } from './helpers';

describe('Auth flow (e2e)', () => {
  let t: TestApp;
  const email = 'new.person@e2e.test';
  const password = 'Secret123';

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it('registers, but login is refused until the email is verified', async () => {
    await t.api().post('/api/v1/auth/register').send({ name: 'New Person', email, password }).expect(201);
    expect(t.mail.codes.get(email)).toMatch(/^\d{6}$/);
    await t.api().post('/api/v1/auth/login').send({ email, password }).expect(403);
  });

  it('rejects a wrong code, accepts the emailed one and returns tokens', async () => {
    const code = t.mail.codes.get(email)!;
    const wrong = code === '000000' ? '111111' : '000000';
    await t.api().post('/api/v1/auth/verify-email').send({ email, code: wrong }).expect(400);
    const res = await t.api().post('/api/v1/auth/verify-email').send({ email, code }).expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({ accessToken: expect.any(String), refreshToken: expect.any(String) }),
    );
    expect(res.body.user.email).toBe(email);
  });

  it('logs in, rejects a wrong password, and protects /me', async () => {
    await t.api().post('/api/v1/auth/login').send({ email, password: 'Wrong1234' }).expect(401);
    const res = await t.api().post('/api/v1/auth/login').send({ email, password }).expect(200);
    await t.api().get('/api/v1/me').expect(401);
    const me = await t.api().get('/api/v1/me').set('Authorization', `Bearer ${res.body.accessToken}`).expect(200);
    expect(me.body.email).toBe(email);
  });

  it('rotates refresh tokens and logs everyone out when an old one is reused', async () => {
    const login = await t.api().post('/api/v1/auth/login').send({ email, password }).expect(200);
    const first = login.body.refreshToken as string;

    const rotated = await t.api().post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(200);
    const second = rotated.body.refreshToken as string;
    expect(second).not.toBe(first);

    // Reusing the first token: treated as stolen, the whole session family is revoked.
    await t.api().post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(401);
    await t.api().post('/api/v1/auth/refresh').send({ refreshToken: second }).expect(401);
  });

  it('validates input', async () => {
    await t.api().post('/api/v1/auth/register').send({ name: 'X', email: 'not-an-email', password: 'short' }).expect(400);
  });
});
