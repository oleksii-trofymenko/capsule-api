import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { AuthService } from '../../src/auth/auth.service.js';
import { parseEnv } from '../../src/config/env.js';
import type { Db } from '../../src/db/db.module.js';
import { refreshTokens, users } from '../../src/db/schema.js';
import { TEST_ENV } from '../support/env.js';
import { createTestDb } from '../support/test-db.js';

describe('AuthService (database)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let auth: AuthService;

  beforeEach(async () => {
    ({ db, close } = await createTestDb());
    const env = parseEnv(TEST_ENV);
    auth = new AuthService(
      db,
      new JwtService({ secret: env.JWT_ACCESS_SECRET }),
      env,
    );
  });
  afterEach(() => close());

  it('stores a hash, never the password or the raw refresh token', async () => {
    const tokens = await auth.register('ana@example.com', 'a-long-password');
    const [user] = await db.select().from(users);
    const [row] = await db.select().from(refreshTokens);

    expect(user.passwordHash).toMatch(/^scrypt\$/);
    expect(user.passwordHash).not.toContain('a-long-password');
    expect(row.tokenHash).not.toBe(tokens.refreshToken);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a second registration with the same email', async () => {
    await auth.register('ana@example.com', 'a-long-password');
    await expect(
      auth.register('ana@example.com', 'another-password'),
    ).rejects.toThrow(/already registered/);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await auth.register('ana@example.com', 'a-long-password');
    const wrong = await auth
      .login('ana@example.com', 'not-the-password')
      .catch((e) => e.message);
    const unknown = await auth
      .login('nobody@example.com', 'not-the-password')
      .catch((e) => e.message);
    expect(wrong).toBe('Invalid email or password');
    expect(unknown).toBe(wrong);
  });

  it('rotates refresh tokens and keeps them in one family', async () => {
    const first = await auth.register('ana@example.com', 'a-long-password');
    const second = await auth.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    const rows = await db.select().from(refreshTokens);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.familyId)).size).toBe(1);
    expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(1);
  });

  it('revokes the whole family when a rotated token is replayed', async () => {
    const first = await auth.register('ana@example.com', 'a-long-password');
    const second = await auth.refresh(first.refreshToken);

    await expect(auth.refresh(first.refreshToken)).rejects.toThrow(
      /Invalid refresh token/,
    );
    // The legitimate holder's newer token is dead too: someone has a copy.
    await expect(auth.refresh(second.refreshToken)).rejects.toThrow(
      /Invalid refresh token/,
    );
  });

  it('lets only one of two concurrent refreshes with the same token succeed', async () => {
    const first = await auth.register('ana@example.com', 'a-long-password');
    const results = await Promise.allSettled([
      auth.refresh(first.refreshToken),
      auth.refresh(first.refreshToken),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('rejects an expired refresh token', async () => {
    const first = await auth.register('ana@example.com', 'a-long-password');
    await db
      .update(refreshTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) });
    await expect(auth.refresh(first.refreshToken)).rejects.toThrow(
      /Invalid refresh token/,
    );
  });

  it('does not affect other logins of the same user on logout', async () => {
    const phone = await auth.register('ana@example.com', 'a-long-password');
    const laptop = await auth.login('ana@example.com', 'a-long-password');
    await auth.logout(phone.refreshToken);

    await expect(auth.refresh(phone.refreshToken)).rejects.toThrow();
    await expect(auth.refresh(laptop.refreshToken)).resolves.toHaveProperty(
      'accessToken',
    );
  });

  it('removes refresh tokens when the user is deleted', async () => {
    await auth.register('ana@example.com', 'a-long-password');
    await db.delete(users).where(eq(users.email, 'ana@example.com'));
    expect(await db.select().from(refreshTokens)).toHaveLength(0);
  });
});
