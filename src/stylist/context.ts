import type { CATEGORIES, FORMALITIES, SEASONS } from '../db/schema.js';
import type { ProfileAnswers } from '../profile/profile.schemas.js';

/** A wardrobe item as the stylist sees it. */
export interface StylistItem {
  id: string;
  name: string;
  category: (typeof CATEGORIES)[number];
  colour: string;
  formality: (typeof FORMALITIES)[number];
  seasons: (typeof SEASONS)[number][];
}

export interface StylistContext {
  wardrobe: StylistItem[];
  profile: ProfileAnswers | null;
}

/**
 * Where the stylist reads a person's wardrobe and profile. The app reads the
 * database; the evaluation passes a fixed sample wardrobe.
 */
export interface StylistContextSource {
  load(userId: string): Promise<StylistContext>;
}

export const STYLIST_CONTEXT = Symbol('STYLIST_CONTEXT');
