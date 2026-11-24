import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { styleProfiles, type StyleProfileRow } from '../db/schema.js';
import type { Locale } from '../locale.js';
import { OutfitsService } from '../outfits/outfits.service.js';
import type { ProfileAnswers } from './profile.schemas.js';

/** English only for now; the user's locale is not modelled yet. */
const LOCALE: Locale = 'en';

const toProfile = (row: StyleProfileRow) => ({
  sizes: row.sizes,
  fit: row.fit,
  directions: row.directions,
  favouriteColours: row.favouriteColours,
  avoidColours: row.avoidColours,
  lifestyle: row.lifestyle,
  neverWear: row.neverWear,
  colourTemperature: row.colourTemperature,
  colourContrast: row.colourContrast,
  height: row.height,
  frame: row.frame,
  playUp: row.playUp,
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class ProfileService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(OutfitsService) private readonly outfits: OutfitsService,
  ) {}

  /** The quiz answers alone, or null before onboarding. */
  async answers(userId: string) {
    const [row] = await this.db
      .select()
      .from(styleProfiles)
      .where(eq(styleProfiles.userId, userId))
      .limit(1);
    return row ? toProfile(row) : null;
  }

  /** The profile as the person sees it: their answers and the feedback they gave. */
  async get(userId: string) {
    const [profile, feedback] = await Promise.all([
      this.answers(userId),
      this.outfits.summary(userId, LOCALE),
    ]);
    return { profile, feedback };
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
    return {
      profile: toProfile(row),
      feedback: await this.outfits.summary(userId, LOCALE),
    };
  }
}
