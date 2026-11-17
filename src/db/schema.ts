import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
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

export type User = typeof users.$inferSelect;
export type PhotoRow = typeof photos.$inferSelect;
export type WardrobeItemRow = typeof wardrobeItems.$inferSelect;
