import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { styleProfiles, type StyleProfileRow } from '../db/schema.js';
import type { ProfileAnswers } from './profile.schemas.js';

const toProfile = (row: StyleProfileRow) => ({
  sizes: row.sizes,
  fit: row.fit,
  directions: row.directions,
  favouriteColours: row.favouriteColours,
  avoidColours: row.avoidColours,
  lifestyle: row.lifestyle,
  neverWear: row.neverWear,
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class ProfileService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async get(userId: string) {
    const [row] = await this.db
      .select()
      .from(styleProfiles)
      .where(eq(styleProfiles.userId, userId))
      .limit(1);
    return { profile: row ? toProfile(row) : null };
  }

  /** Saves the quiz answers, replacing any earlier ones. */
  async save(userId: string, answers: ProfileAnswers) {
    const [row] = await this.db
      .insert(styleProfiles)
      .values({ userId, ...answers })
      .onConflictDoUpdate({
        target: styleProfiles.userId,
        set: { ...answers, updatedAt: new Date() },
      })
      .returning();
    return { profile: toProfile(row) };
  }
}
