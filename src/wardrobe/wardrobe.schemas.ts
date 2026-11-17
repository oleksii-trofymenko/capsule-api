import { z } from 'zod';
import {
  CATEGORIES,
  FORMALITIES,
  SEASONS,
  SIZE_SYSTEMS,
} from '../db/schema.js';

export const sizeSchema = z
  .object({
    system: z.enum(SIZE_SYSTEMS),
    value: z.string().trim().min(1).max(10),
  })
  .describe('A size is stored with its system: UK 12, EU 40, INT M');

const itemFields = {
  name: z.string().trim().min(1).max(120),
  category: z.enum(CATEGORIES),
  colour: z.string().trim().min(1).max(40),
  formality: z.enum(FORMALITIES),
  seasons: z
    .array(z.enum(SEASONS))
    .min(1)
    .max(4)
    .refine((s) => new Set(s).size === s.length, 'seasons must not repeat'),
  size: sizeSchema.nullable(),
  photoId: z
    .uuid()
    .nullable()
    .describe('An uploaded photo of yours showing this item'),
};

export const createItemSchema = z.object({
  ...itemFields,
  size: itemFields.size.default(null),
  photoId: itemFields.photoId.default(null),
});

export const updateItemSchema = z
  .object(itemFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');

export const itemIdSchema = z.uuid();

export const itemSchema = z.object({
  id: z.uuid(),
  ...itemFields,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const itemListSchema = z.object({ items: z.array(itemSchema) });

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type WardrobeItem = z.infer<typeof itemSchema>;
