import { z } from 'zod';

const spec = z.object({ provider: z.string(), model: z.string() });

export const modelsStatusSchema = z.object({
  routes: z.object({ vision: spec, reasoning: spec, embedding: spec }),
  providers: z.record(
    z.string(),
    z.object({ ok: z.boolean(), detail: z.string().optional() }),
  ),
});
