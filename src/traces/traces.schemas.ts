import { z } from 'zod';

export const traceIdSchema = z.uuid();

/** One model call: the step that made it, what the model saw and what it returned. */
export const traceCallSchema = z.object({
  step: z.string(),
  messages: z.array(z.object({ role: z.string(), text: z.string() })),
  /** The reply text, or the structured output as JSON; null if the call failed or was cut off. */
  output: z.string().nullable(),
  failed: z.boolean(),
});

/** One stylist answer, as the person can open it later. */
export const newTraceSchema = z.object({
  steps: z.array(z.string()),
  occasion: z.string().nullable(),
  /** Wardrobe items retrieved for the outfit, by name. */
  candidates: z.array(z.string()),
  /** Items in the outfit sent to the person, by name. */
  outfit: z.array(z.string()),
  calls: z.array(traceCallSchema),
  failed: z.boolean(),
});

export const traceSchema = newTraceSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
});

export type TraceCall = z.infer<typeof traceCallSchema>;
export type NewTrace = z.infer<typeof newTraceSchema>;
export type Trace = z.infer<typeof traceSchema>;
