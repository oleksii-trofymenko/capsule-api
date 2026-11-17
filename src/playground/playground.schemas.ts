import { z } from 'zod';

export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40)
    .refine(
      (m) => m.at(-1)?.role === 'user',
      'the last message must be from the user',
    ),
  /** Replaces the default system prompt for this request, to compare wordings. */
  systemPrompt: z.string().max(4000).optional(),
  /** Set false to see how the model answers with no tools available. */
  tools: z.boolean().default(true),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Everything the endpoint can send, as `event: <type>` + `data: <json>` over SSE. */
export type ChatEvent =
  | {
      type: 'start';
      provider: string;
      model: string;
      tools: string[];
      systemPrompt: string;
    }
  | { type: 'token'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | {
      type: 'tool_result';
      id: string;
      name: string;
      ok: boolean;
      result: string;
      ms: number;
    }
  | {
      type: 'done';
      ms: number;
      firstTokenMs: number | null;
      modelCalls: number;
      inputTokens: number | null;
      outputTokens: number | null;
    }
  | { type: 'error'; message: string };
