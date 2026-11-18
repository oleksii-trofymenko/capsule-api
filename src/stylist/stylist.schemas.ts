import { z } from 'zod';

export const stylistChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(30)
    .refine(
      (m) => m.at(-1)?.role === 'user',
      'the last message must be from the user',
    ),
});

export type StylistChatRequest = z.infer<typeof stylistChatSchema>;
export type ChatMessage = StylistChatRequest['messages'][number];

/** The understand step's structured output. */
export const understandingSchema = z.object({
  intent: z.enum(['outfit', 'question']),
  enoughToSuggest: z.boolean(),
  // Loose here so one bad note cannot spoil the classification; each is checked in notes.ts.
  remember: z
    .array(z.object({ kind: z.string(), text: z.string() }))
    .default([]),
});

/** The compose step's structured output: ids only, checked against the candidates in code. */
export const outfitPickSchema = z.object({
  itemIds: z.array(z.string()).max(6),
  missing: z.string().max(200).nullable(),
});

export type Understanding = z.infer<typeof understandingSchema>;
export type OutfitPick = z.infer<typeof outfitPickSchema>;

/** What the stylist actually gave the model on this turn. */
export type Consulted = 'wardrobe' | 'dress-code' | 'date';

export type StylistStep =
  | 'load-context'
  | 'understand'
  | 'clarify'
  | 'retrieve-wardrobe'
  | 'compose'
  | 'check-rules'
  | 'answer'
  | 'write';

/** Everything the endpoint streams, as `event: <type>` + `data: <json>` over SSE. */
export type StylistEvent =
  | { type: 'step'; step: StylistStep }
  | {
      type: 'outfit';
      /** The saved outfit, for feedback; null when nothing was chosen or saving failed. */
      id: string | null;
      occasion: string | null;
      items: { id: string; name: string }[];
      removed: { name: string; reason: string }[];
      missing: string | null;
    }
  | { type: 'token'; text: string }
  | {
      type: 'done';
      ms: number;
      firstTokenMs: number | null;
      consulted: Consulted[];
    }
  | { type: 'error'; message: string };
