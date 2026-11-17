import request from 'supertest';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('Auth API', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const credentials = { email: 'ana@example.com', password: 'a-long-password' };

  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(() => t.close());

  it('registers, then serves the profile only with the access token', async () => {
    const res = await http()
      .post('/v1/auth/register')
      .send(credentials)
      .expect(201);
    expect(res.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(res.body).not.toHaveProperty('passwordHash');

    await http().get('/v1/auth/me').expect(401);
    await http()
      .get('/v1/auth/me')
      .set('Authorization', 'Bearer not.a.jwt')
      .expect(401);
    const me = await http()
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
    expect(me.body).toEqual({
      id: expect.any(String),
      email: 'ana@example.com',
    });
  });

  it('normalises email case and whitespace', async () => {
    await http().post('/v1/auth/register').send(credentials).expect(201);
    await http()
      .post('/v1/auth/login')
      .send({ email: '  Ana@Example.COM ', password: credentials.password })
      .expect(200);
    await http()
      .post('/v1/auth/register')
      .send({ ...credentials, email: 'ANA@example.com' })
      .expect(409);
  });

  it.each([
    ['a missing body', undefined],
    [
      'an invalid email',
      { email: 'not-an-email', password: 'a-long-password' },
    ],
    ['a short password', { email: 'ana@example.com', password: 'short' }],
    [
      'a non-string password',
      { email: 'ana@example.com', password: 1234567890123 },
    ],
  ])('rejects %s with 400', async (_name, body) => {
    await http().post('/v1/auth/register').send(body).expect(400);
  });

  it('answers a wrong password and an unknown email identically', async () => {
    await http().post('/v1/auth/register').send(credentials).expect(201);
    const wrong = await http()
      .post('/v1/auth/login')
      .send({ ...credentials, password: 'wrong-password' })
      .expect(401);
    const unknown = await http()
      .post('/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' })
      .expect(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('rotates refresh tokens and kills the session when an old one is replayed', async () => {
    const first = (
      await http().post('/v1/auth/register').send(credentials).expect(201)
    ).body;
    const second = (
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200)
    ).body;
    expect(second.refreshToken).not.toBe(first.refreshToken);

    await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);
    await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: second.refreshToken })
      .expect(401);
  });

  it('logs out by revoking the refresh token', async () => {
    const tokens = (
      await http().post('/v1/auth/register').send(credentials).expect(201)
    ).body;
    await http()
      .post('/v1/auth/logout')
      .send({ refreshToken: tokens.refreshToken })
      .expect(204);
    await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect(401);
  });

  it('rejects an access token signed with a different secret or with alg "none"', async () => {
    const { JwtService } = await import('@nestjs/jwt');
    const forged = await new JwtService({ secret: 'x'.repeat(40) }).signAsync(
      {
        sub: '00000000-0000-0000-0000-000000000000',
        email: 'evil@example.com',
      },
      { issuer: 'capsule-api' },
    );
    await http()
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);

    const b64 = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'x', email: 'evil@example.com', iss: 'capsule-api' })}.`;
    await http()
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${unsigned}`)
      .expect(401);
  });
});
