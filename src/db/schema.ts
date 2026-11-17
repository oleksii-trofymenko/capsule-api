import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the opaque token. The raw token is never stored. */
    tokenHash: text('token_hash').notNull().unique(),
    /** All tokens descended from one login share a family, so reuse can revoke them together. */
    familyId: uuid('family_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('refresh_tokens_user_idx').on(t.userId),
    index('refresh_tokens_family_idx').on(t.familyId),
  ],
);

export const CATEGORIES = [
  'top',
  'bottom',
  'dress',
  'outerwear',
  'shoes',
  'accessory',
] as const;
export const FORMALITIES = ['casual', 'smart', 'formal'] as const;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
/** INT is letter sizing (XS to XXL). A size is meaningless without its system. */
export const SIZE_SYSTEMS = ['UK', 'EU', 'US', 'INT'] as const;

/** What the vision model suggested for a photo. Same fields a wardrobe item starts from. */
export interface PhotoTags {
  name: string;
  category: (typeof CATEGORIES)[number];
  colour: string;
  formality: (typeof FORMALITIES)[number];
  seasons: (typeof SEASONS)[number][];
}

export const photos = pgTable(
  'photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Key in the photo bucket. The photo itself never enters the database. */
    storageKey: text('storage_key').notNull().unique(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    status: text('status', { enum: ['pending', 'uploaded'] })
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    tagStatus: text('tag_status', { enum: ['pending', 'tagged', 'failed'] })
      .notNull()
      .default('pending'),
    /** The model's suggestion, kept as it was so user corrections can be measured against it. */
    tags: jsonb('tags').$type<PhotoTags>(),
    /** `provider:model` that produced the tags. */
    tagModel: text('tag_model'),
    taggedAt: timestamp('tagged_at', { withTimezone: true }),
  },
  (t) => [index('photos_user_idx').on(t.userId)],
);

export const wardrobeItems = pgTable(
  'wardrobe_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    photoId: uuid('photo_id').references(() => photos.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    category: text('category', { enum: CATEGORIES }).notNull(),
    colour: text('colour').notNull(),
    formality: text('formality', { enum: FORMALITIES }).notNull(),
    seasons: text('seasons', { enum: SEASONS }).array().notNull(),
    sizeSystem: text('size_system', { enum: SIZE_SYSTEMS }),
    sizeValue: text('size_value'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('wardrobe_items_user_idx').on(t.userId),
    index('wardrobe_items_photo_idx').on(t.photoId),
  ],
);

/** Answer codes for the style quiz. Labels live in src/profile/quiz.ts, per locale. */
export const FITS = ['fitted', 'regular', 'relaxed'] as const;
export const STYLE_DIRECTIONS = [
  'classic',
  'minimal',
  'smart-casual',
  'streetwear',
  'romantic',
  'bohemian',
  'edgy',
  'sporty',
  'preppy',
] as const;
export const COLOUR_FAMILIES = [
  'neutrals',
  'earth-tones',
  'blues',
  'pastels',
  'brights',
  'jewel-tones',
] as const;
export const LIFESTYLES = [
  'office',
  'smart-casual-work',
  'casual',
  'active',
  'mixed',
] as const;
export const NEVER_WEAR = [
  'high-necklines',
  'sleeveless',
  'short-hemlines',
  'skinny-fits',
  'heels',
  'logos',
  'bold-patterns',
] as const;

export interface Size {
  system: (typeof SIZE_SYSTEMS)[number];
  value: string;
}
export interface ProfileSizes {
  top: Size | null;
  bottom: Size | null;
  shoes: Size | null;
}

export const styleProfiles = pgTable('style_profiles', {
  /** One profile per user. */
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Every size carries its system: UK 12 and EU 40 are not comparable numbers. */
  sizes: jsonb('sizes').$type<ProfileSizes>().notNull(),
  fit: text('fit', { enum: FITS }).notNull(),
  directions: text('directions', { enum: STYLE_DIRECTIONS }).array().notNull(),
  favouriteColours: text('favourite_colours', { enum: COLOUR_FAMILIES })
    .array()
    .notNull(),
  avoidColours: text('avoid_colours', { enum: COLOUR_FAMILIES })
    .array()
    .notNull(),
  lifestyle: text('lifestyle', { enum: LIFESTYLES }).notNull(),
  neverWear: text('never_wear', { enum: NEVER_WEAR }).array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** An item as it was when the outfit was suggested; survives the item being deleted. */
export interface OutfitItemSnapshot {
  itemId: string;
  name: string;
}

/** Outfits the stylist suggested, with the person's feedback on each. */
export const outfits = pgTable(
  'outfits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    occasionId: text('occasion_id'),
    items: jsonb('items').$type<OutfitItemSnapshot[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Like and dislike exclude each other; wearing an outfit is separate. */
    rating: text('rating', { enum: ['like', 'dislike'] }),
    worn: boolean('worn').notNull().default(false),
    note: text('note'),
    feedbackAt: timestamp('feedback_at', { withTimezone: true }),
  },
  (t) => [index('outfits_user_idx').on(t.userId)],
);

/**
 * Length of the embedding vectors. It belongs to the embedding model
 * (nomic-embed-text gives 768): a model with another length needs a migration.
 */
export const EMBEDDING_DIMENSIONS = 768;

/** Where knowledge comes from. Only sources listed in docs/SOURCES.md may be ingested (T15). */
export const knowledgeSources = pgTable('knowledge_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /** Null for sources with no address, such as a book. */
  url: text('url'),
  licence: text('licence').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Shared knowledge, not user data: passages belong to sources, never to a user. */
export const knowledgePassages = pgTable(
  'knowledge_passages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    /** When the source published it: retrieval prefers recent passages. */
    publishedOn: date('published_on', { mode: 'string' }).notNull(),
    /** Trend records name the seasons they apply to; empty means any season. */
    seasons: text('seasons', { enum: SEASONS }).array().notNull().default([]),
    embedding: vector('embedding', {
      dimensions: EMBEDDING_DIMENSIONS,
    }).notNull(),
    /** Vectors from different models cannot be compared, so each row says which made it. */
    embeddingModel: text('embedding_model').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('knowledge_passages_source_idx').on(t.sourceId),
    index('knowledge_passages_embedding_idx').using(
      'hnsw',
      t.embedding.op('vector_cosine_ops'),
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type PhotoRow = typeof photos.$inferSelect;
export type WardrobeItemRow = typeof wardrobeItems.$inferSelect;
export type StyleProfileRow = typeof styleProfiles.$inferSelect;
export type OutfitRow = typeof outfits.$inferSelect;
export type KnowledgePassageRow = typeof knowledgePassages.$inferSelect;
