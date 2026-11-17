import { z } from 'zod';
import { CATEGORIES, FORMALITIES } from '../db/schema.js';

const id = z.string().regex(/^[a-z0-9-]+$/, 'ids are lower-case-with-dashes');
/** Lower-case words matched against item names and colours. */
const words = z.array(z.string().regex(/^[a-z-]+$/)).min(1);

/** Which garments a rule looks at. Formality rules default to every category but accessories. */
const categories = z.array(z.enum(CATEGORIES)).min(1);

export const ruleSchema = z.discriminatedUnion('type', [
  z.object({
    id,
    type: z.literal('minFormality'),
    level: z.enum(FORMALITIES),
    categories: categories.optional(),
  }),
  z.object({
    id,
    type: z.literal('maxFormality'),
    level: z.enum(FORMALITIES),
    categories: categories.optional(),
  }),
  /** No item whose name contains one of these words. */
  z.object({ id, type: z.literal('forbidItems'), words }),
  /** The outfit's main colour (dress, else outer layer, else top) is none of these. */
  z.object({ id, type: z.literal('forbidMainColour'), colours: words }),
  /** Items in these categories are in one of these colours. */
  z.object({
    id,
    type: z.literal('onlyColours'),
    colours: words,
    categories,
  }),
]);

/** data/occasions/occasions.json: structure and rules, the same in every locale. */
export const occasionFileSchema = z.object({
  occasions: z.array(
    z.object({
      id,
      formality: z.enum(FORMALITIES),
      rules: z.array(ruleSchema),
    }),
  ),
});

/** data/occasions/<locale>.json: the words for each occasion. */
export const occasionTextFileSchema = z.record(
  z.string(),
  z.object({
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    guidance: z.string().min(1),
    rules: z.record(z.string(), z.string().min(1)),
  }),
);

export type Rule = z.infer<typeof ruleSchema>;
export type OccasionFile = z.infer<typeof occasionFileSchema>;
export type OccasionTextFile = z.infer<typeof occasionTextFileSchema>;
