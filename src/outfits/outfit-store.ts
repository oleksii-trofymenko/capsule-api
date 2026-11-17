import type { OutfitItemSnapshot } from '../db/schema.js';

export interface NewOutfit {
  occasionId: string | null;
  items: OutfitItemSnapshot[];
}

/** Where the stylist saves the outfits it suggests. The app uses the database; the evaluation keeps them in memory. */
export interface OutfitStore {
  save(userId: string, outfit: NewOutfit): Promise<string>;
}

export const OUTFIT_STORE = Symbol('OUTFIT_STORE');
