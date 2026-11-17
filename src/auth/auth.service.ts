import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.module.js';
import { refreshTokens, users, type User } from '../db/schema.js';
import type { Tokens } from './auth.schemas.js';
import { hashPassword, verifyPassword } from './password.js';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  /** Verified against when the email is unknown, so both login failures cost the same time. */
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async register(email: string, password: string): Promise<Tokens> {
    const passwordHash = await hashPassword(password);
    const [user] = await this.db
      .insert(users)
      .values({ email, passwordHash })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (!user) throw new ConflictException('Email is already registered');
    return this.issueTokens(user, randomUUID());
  }

  async login(email: string, password: string): Promise<Tokens> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    this.dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
    const ok = await verifyPassword(
      password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    // One message for both cases: do not reveal which emails exist.
    if (!user || !ok)
      throw new UnauthorizedException('Invalid email or password');
    return this.issueTokens(user, randomUUID());
  }

  /**
   * Refresh tokens are single use. Presenting one that was already rotated means
   * it was copied, so every token descended from that login is revoked.
   */
  async refresh(refreshToken: string): Promise<Tokens> {
    const tokenHash = sha256(refreshToken);
    const now = new Date();

    // Claim the token atomically: of two concurrent requests only one can win.
    const [claimed] = await this.db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
        ),
      )
      .returning();

    if (!claimed) {
      const [seen] = await this.db
        .select({ familyId: refreshTokens.familyId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);
      if (seen) await this.revokeFamily(seen.familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (claimed.expiresAt <= now)
      throw new UnauthorizedException('Invalid refresh token');

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, claimed.userId))
      .limit(1);
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    return this.issueTokens(user, claimed.familyId);
  }

  async logout(refreshToken: string): Promise<void> {
    const [row] = await this.db
      .select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, sha256(refreshToken)))
      .limit(1);
    if (row) await this.revokeFamily(row.familyId);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.familyId, familyId),
          isNull(refreshTokens.revokedAt),
        ),
      );
  }

  private async issueTokens(user: User, familyId: string): Promise<Tokens> {
    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
    );
    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      familyId,
      expiresAt,
    });
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
    };
  }
}
