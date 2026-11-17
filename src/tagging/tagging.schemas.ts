import { z } from 'zod';
import {
  CATEGORIES,
  FORMALITIES,
  SEASONS,
  type PhotoTags,
} from '../db/schema.js';

/** What the vision model must return. Validated again after the call: model output is untrusted. */
export const photoTagsSchema = z.object({
  name: z.string().trim().min(1).max(60),
  category: z.enum(CATEGORIES),
  colour: z.string().trim().min(1).max(40),
  formality: z.enum(FORMALITIES),
  seasons: z.array(z.enum(SEASONS)).min(1).max(4),
}) satisfies z.ZodType<PhotoTags>;

/** Small models sometimes repeat a season; keep each once, in calendar order. */
export function normaliseTags(tags: PhotoTags): PhotoTags {
  return { ...tags, seasons: SEASONS.filter((s) => tags.seasons.includes(s)) };
}
