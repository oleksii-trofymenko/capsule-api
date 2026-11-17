import { z } from 'zod';

export const outfitIdSchema = z.uuid();

export const feedbackSchema = z
  .object({
    rating: z
      .enum(['like', 'dislike'])
      .nullable()
      .describe('null clears an earlier like or dislike'),
    worn: z.boolean(),
    note: z.string().trim().max(500).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');

export const outfitSchema = z.object({
  id: z.uuid(),
  occasionId: z.string().nullable(),
  items: z.array(z.object({ itemId: z.string(), name: z.string() })),
  createdAt: z.iso.datetime(),
  rating: z.enum(['like', 'dislike']).nullable(),
  worn: z.boolean(),
  note: z.string().nullable(),
  feedbackAt: z.iso.datetime().nullable(),
});

/** Feedback as the profile shows it: counts and the latest pieces. */
export const feedbackSummarySchema = z.object({
  liked: z.number().int(),
  disliked: z.number().int(),
  worn: z.number().int(),
  recent: z.array(
    z.object({
      outfitId: z.uuid(),
      occasion: z
        .string()
        .nullable()
        .describe('Occasion name, if one was known'),
      items: z.array(z.string()),
      rating: z.enum(['like', 'dislike']).nullable(),
      worn: z.boolean(),
      note: z.string().nullable(),
      feedbackAt: z.iso.datetime(),
    }),
  ),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type Outfit = z.infer<typeof outfitSchema>;
export type FeedbackSummary = z.infer<typeof feedbackSummarySchema>;
