import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import type { Locale } from '../stylist/persona.js';
import type { Transcript } from './checks.js';
import { judgePrompts } from './judge-prompt.js';
import type { EvalScenario } from './scenarios.js';

export const verdictSchema = z.object({
  ownedOnly: z.boolean(),
  followsRules: z.boolean(),
  tone: z.number().int().min(1).max(5),
  wearability: z.number().int().min(1).max(5).nullable(),
  reason: z.string().max(500),
});

export type Verdict = z.infer<typeof verdictSchema>;

/** Grades one reply; null when the judge failed to give a valid verdict. */
export type Judge = (
  scenario: EvalScenario,
  transcript: Transcript,
) => Promise<Verdict | null>;

export function buildJudgeMessages(
  locale: Locale,
  wardrobe: string[],
  scenario: EvalScenario,
  transcript: Transcript,
): BaseMessage[] {
  const conversation = scenario.messages
    .map((m) => `${m.role === 'user' ? 'Person' : 'Capsule'}: ${m.content}`)
    .join('\n');
  return [
    new SystemMessage(judgePrompts[locale]),
    new HumanMessage(
      [
        `Owned items:\n${wardrobe.map((item) => `- ${item}`).join('\n')}`,
        `What a good reply does here: ${scenario.expect}`,
        `Conversation:\n${conversation}`,
        `Reply to grade:\n${transcript.answer || '(no reply)'}`,
      ].join('\n\n'),
    ),
  ];
}

/** A judge backed by a chat model. Small models sometimes return invalid output, so it tries twice. */
export function createJudge(
  model: BaseChatModel,
  locale: Locale,
  wardrobe: string[],
): Judge {
  const structured = model.withStructuredOutput(verdictSchema, {
    name: 'verdict',
  });
  return async (scenario, transcript) => {
    const messages = buildJudgeMessages(locale, wardrobe, scenario, transcript);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const parsed = verdictSchema.safeParse(
          await structured.invoke(messages),
        );
        if (parsed.success) return parsed.data;
      } catch {
        // Invalid JSON from the model: try once more.
      }
    }
    return null;
  };
}
