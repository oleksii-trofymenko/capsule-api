import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { outfits, type OutfitRow } from '../db/schema.js';
import type { Locale } from '../locale.js';
import { OccasionsService } from '../occasions/occasions.service.js';
import type { NewOutfit, OutfitStore } from './outfit-store.js';
import type {
  FeedbackInput,
  FeedbackSummary,
  Outfit,
} from './outfits.schemas.js';

/** How many recent pieces of feedback the profile shows. */
const RECENT = 10;

const toOutfit = (row: OutfitRow): Outfit => ({
  id: row.id,
  occasionId: row.occasionId,
  items: row.items,
  createdAt: row.createdAt.toISOString(),
  rating: row.rating,
  worn: row.worn,
  note: row.note,
  feedbackAt: row.feedbackAt?.toISOString() ?? null,
});

@Injectable()
export class OutfitsService implements OutfitStore {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(OccasionsService) private readonly occasions: OccasionsService,
  ) {}

  async save(userId: string, outfit: NewOutfit): Promise<string> {
    const [row] = await this.db
      .insert(outfits)
      .values({ userId, ...outfit })
      .returning({ id: outfits.id });
    return row.id;
  }

  /** Records feedback on one of the user's outfits. Later feedback replaces earlier. */
  async setFeedback(
    userId: string,
    id: string,
    input: FeedbackInput,
  ): Promise<Outfit> {
    const [row] = await this.db
      .update(outfits)
      .set({ ...input, feedbackAt: new Date() })
      .where(and(eq(outfits.id, id), eq(outfits.userId, userId)))
      .returning();
    if (!row) throw new NotFoundException('Outfit not found');
    return toOutfit(row);
  }

  async summary(userId: string, locale: Locale): Promise<FeedbackSummary> {
    const mine = eq(outfits.userId, userId);
    const [counts] = await this.db
      .select({
        liked:
          sql<number>`count(*) filter (where ${outfits.rating} = 'like')`.mapWith(
            Number,
          ),
        disliked:
          sql<number>`count(*) filter (where ${outfits.rating} = 'dislike')`.mapWith(
            Number,
          ),
        worn: sql<number>`count(*) filter (where ${outfits.worn})`.mapWith(
          Number,
        ),
      })
      .from(outfits)
      .where(mine);
    const recent = await this.db
      .select()
      .from(outfits)
      .where(and(mine, isNotNull(outfits.feedbackAt)))
      .orderBy(desc(outfits.feedbackAt))
      .limit(RECENT);
    return {
      ...counts,
      recent: recent.map((r) => ({
        outfitId: r.id,
        occasion: r.occasionId
          ? (this.occasions.get(r.occasionId)?.text[locale].name ?? null)
          : null,
        items: r.items.map((i) => i.name),
        rating: r.rating,
        worn: r.worn,
        note: r.note,
        feedbackAt: (r.feedbackAt ?? r.createdAt).toISOString(),
      })),
    };
  }
}
