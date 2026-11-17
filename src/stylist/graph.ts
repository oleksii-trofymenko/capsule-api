import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import {
  Annotation,
  END,
  START,
  StateGraph,
  type LangGraphRunnableConfig,
} from '@langchain/langgraph';
import type { Logger } from '@nestjs/common';
import type { Locale } from '../locale.js';
import type { ModelRouter } from '../models/model-router.service.js';
import type { Occasion } from '../occasions/load-occasions.js';
import type { OccasionsService } from '../occasions/occasions.service.js';
import { stylistPersona } from './persona.js';
import { describeItem, filterCandidates, seasonOf } from './candidates.js';
import type {
  StylistContext,
  StylistContextSource,
  StylistItem,
} from './context.js';
import { stylistPrompts } from './stylist.prompts.js';
import {
  outfitPickSchema,
  understandingSchema,
  type ChatMessage,
  type Consulted,
  type StylistEvent,
  type Understanding,
} from './stylist.schemas.js';

export interface GraphDeps {
  models: ModelRouter;
  occasions: OccasionsService;
  context: StylistContextSource;
  logger: Pick<Logger, 'warn'>;
}

interface Outfit {
  items: StylistItem[];
  missing: string | null;
  /** Items dropped because they still broke a rule after one retry. */
  removed: { name: string; reason: string }[];
}

/** A state field that keeps the latest value written to it. */
const latest = <T>(initial: T) =>
  Annotation<T>({ reducer: (_, next) => next, default: () => initial });

const State = Annotation.Root({
  userId: Annotation<string>,
  locale: Annotation<Locale>,
  now: Annotation<Date>,
  messages: Annotation<ChatMessage[]>,
  context: latest<StylistContext>({ wardrobe: [], profile: null }),
  occasion: latest<Occasion | null>(null),
  understanding: latest<Understanding | null>(null),
  candidates: latest<StylistItem[]>([]),
  outfit: latest<Outfit | null>(null),
  consulted: Annotation<Consulted[]>({
    reducer: (a, b) => [...new Set([...a, ...b])],
    default: () => [],
  }),
});

type GraphState = typeof State.State;

const emit = (config: LangGraphRunnableConfig, event: StylistEvent) =>
  config.writer?.(event);

const conversation = (messages: ChatMessage[]): BaseMessage[] =>
  messages.map((m) =>
    m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
  );

/** The prompt blocks that describe the situation, built from state; never includes item ids. */
function situation(s: GraphState): string[] {
  const l = stylistPrompts[s.locale].labels;
  const blocks = [
    `${l.today}: ${s.now.toISOString().slice(0, 10)}, ${seasonOf(s.now)}.`,
  ];
  if (s.occasion) {
    const t = s.occasion.text[s.locale];
    const rules = Object.values(t.rules);
    blocks.push(
      `${l.occasion}: ${t.name}. ${t.guidance}` +
        (rules.length ? `\n${l.rules}:\n- ${rules.join('\n- ')}` : ''),
    );
  } else {
    blocks.push(l.noOccasion);
  }
  const p = s.context.profile;
  if (p) {
    const sizes = Object.entries(p.sizes)
      .flatMap(([part, size]) =>
        size ? [`${part} ${size.system} ${size.value}`] : [],
      )
      .join(', ');
    blocks.push(
      `${l.profile}: sizes ${sizes || '-'}; fit ${p.fit}; style ${p.directions.join(', ')}; ` +
        `loves ${p.favouriteColours.join(', ') || '-'}; avoids ${p.avoidColours.join(', ') || '-'}; ` +
        `never wears ${p.neverWear.join(', ') || '-'}; week ${p.lifestyle}.`,
    );
  }
  return blocks;
}

/** Messages for a model call: one system message with the instructions and context, then the conversation. */
const prompt = (system: string[], s: GraphState): BaseMessage[] => [
  new SystemMessage(system.join('\n\n')),
  ...conversation(s.messages),
];

async function streamReply(
  deps: GraphDeps,
  messages: BaseMessage[],
  config: LangGraphRunnableConfig,
) {
  const model = deps.models.chat('reasoning');
  for await (const chunk of await model.stream(messages, {
    signal: config.signal,
  })) {
    const text = typeof chunk.content === 'string' ? chunk.content : '';
    if (text) emit(config, { type: 'token', text });
  }
}

/** Picks items from the candidates; ids the model invents are dropped here. */
async function pickOutfit(
  deps: GraphDeps,
  s: GraphState,
  retryNote: string | null,
  config: LangGraphRunnableConfig,
): Promise<Outfit> {
  const p = stylistPrompts[s.locale];
  const list = s.candidates.map((i) => `${i.id}: ${describeItem(i)}`);
  const system = [
    p.compose,
    ...situation(s),
    `${p.labels.candidates}:\n${list.join('\n') || '-'}`,
  ];
  if (retryNote) system.push(`${p.labels.retry}: ${retryNote}`);
  const model = deps.models
    .chat('reasoning')
    .withStructuredOutput(outfitPickSchema, { name: 'outfit' });
  const byId = new Map(s.candidates.map((i) => [i.id, i]));
  // Small models sometimes return invalid output: two attempts, then an empty outfit.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await model.invoke(prompt(system, s), {
        signal: config.signal,
      });
      const pick = outfitPickSchema.parse(raw);
      const items = [...new Set(pick.itemIds)].flatMap((id) => {
        const item = byId.get(id);
        return item ? [item] : [];
      });
      return { items, missing: nothingMissing(pick.missing), removed: [] };
    } catch {
      // Invalid output: try once more.
    }
  }
  deps.logger.warn('Compose gave no valid outfit after two attempts');
  return { items: [], missing: null, removed: [] };
}

/** Models sometimes write "null" or "none" as text for "nothing is missing". */
const nothingMissing = (missing: string | null) =>
  missing && !/^(null|none|nothing|n\/a)?$/i.test(missing.trim())
    ? missing
    : null;

export function buildStylistGraph(deps: GraphDeps) {
  const graph = new StateGraph(State)
    .addNode('load-context', async (s, config) => {
      emit(config, { type: 'step', step: 'load-context' });
      const context = await deps.context.load(s.userId);
      // The occasion is found in code, latest user message first.
      const userTurns = s.messages.filter((m) => m.role === 'user').reverse();
      const occasion =
        userTurns
          .map((m) => deps.occasions.find(m.content, s.locale))
          .find((o) => o !== undefined) ?? null;
      return { context, occasion };
    })
    .addNode('understand', async (s, config) => {
      emit(config, { type: 'step', step: 'understand' });
      try {
        const raw = await deps.models
          .chat('reasoning')
          .withStructuredOutput(understandingSchema, { name: 'understanding' })
          .invoke(prompt([stylistPrompts[s.locale].understand], s), {
            signal: config.signal,
          });
        return { understanding: understandingSchema.parse(raw) };
      } catch {
        // Answering is the safe fallback: it never invents an outfit.
        return {
          understanding: { intent: 'question', enoughToSuggest: true } as const,
        };
      }
    })
    .addNode('clarify', async (s, config) => {
      emit(config, { type: 'step', step: 'clarify' });
      emit(config, { type: 'token', text: stylistPrompts[s.locale].clarify });
      return {};
    })
    .addNode('retrieve-wardrobe', async (s, config) => {
      emit(config, { type: 'step', step: 'retrieve-wardrobe' });
      const candidates = filterCandidates(
        s.context.wardrobe,
        s.occasion?.rules ?? [],
        s.context.profile?.neverWear ?? [],
      );
      return { candidates, consulted: ['wardrobe'] };
    })
    .addNode('compose', async (s, config) => {
      emit(config, { type: 'step', step: 'compose' });
      const outfit = await pickOutfit(deps, s, null, config);
      const consulted: Consulted[] = s.occasion
        ? ['date', 'dress-code']
        : ['date'];
      return { outfit, consulted };
    })
    .addNode('check-rules', async (s, config) => {
      emit(config, { type: 'step', step: 'check-rules' });
      const occasion = s.occasion;
      if (!occasion || !s.outfit) return {};
      const check = (o: Outfit) => {
        const result = deps.occasions.check(occasion.id, o.items, s.locale);
        return result.found ? result.breaks : [];
      };
      let outfit = s.outfit;
      let breaks = check(outfit);
      if (breaks.length > 0) {
        // One retry with the reasons, then drop whatever still breaks a rule.
        const note = breaks
          .map((b) => `${b.items.join(', ')}: ${b.message}`)
          .join('; ');
        outfit = await pickOutfit(deps, s, note, config);
        breaks = check(outfit);
      }
      const bad = new Map(
        breaks.flatMap((b) => b.items.map((name) => [name, b.message])),
      );
      return {
        outfit: {
          items: outfit.items.filter((i) => !bad.has(i.name)),
          missing: outfit.missing,
          removed: [...bad].map(([name, reason]) => ({ name, reason })),
        },
      };
    })
    .addNode('write', async (s, config) => {
      emit(config, { type: 'step', step: 'write' });
      const outfit = s.outfit ?? { items: [], missing: null, removed: [] };
      emit(config, {
        type: 'outfit',
        occasion: s.occasion?.id ?? null,
        items: outfit.items.map((i) => ({ id: i.id, name: i.name })),
        removed: outfit.removed,
        missing: outfit.missing,
      });
      const l = stylistPrompts[s.locale].labels;
      const blocks = [
        stylistPersona[s.locale],
        stylistPrompts[s.locale].write,
        ...situation(s),
        `${l.outfit}:\n- ${outfit.items.map((i) => i.name).join('\n- ') || '-'}`,
      ];
      if (outfit.missing) blocks.push(`${l.missing}: ${outfit.missing}`);
      if (outfit.removed.length > 0) {
        const lines = outfit.removed.map((r) => `${r.name}: ${r.reason}`);
        blocks.push(`${l.removed}:\n- ${lines.join('\n- ')}`);
      }
      await streamReply(deps, prompt(blocks, s), config);
      return {};
    })
    .addNode('answer', async (s, config) => {
      emit(config, { type: 'step', step: 'answer' });
      const l = stylistPrompts[s.locale].labels;
      const wardrobe = s.context.wardrobe.map(describeItem);
      const blocks = [
        stylistPersona[s.locale],
        stylistPrompts[s.locale].answer,
        ...situation(s),
        wardrobe.length
          ? `${l.wardrobe}:\n- ${wardrobe.join('\n- ')}`
          : l.emptyWardrobe,
      ];
      await streamReply(deps, prompt(blocks, s), config);
      const consulted: Consulted[] = s.occasion
        ? ['wardrobe', 'date', 'dress-code']
        : ['wardrobe', 'date'];
      return { consulted };
    })
    .addEdge(START, 'load-context')
    .addEdge('load-context', 'understand')
    .addConditionalEdges(
      'understand',
      (s) => {
        if (s.understanding?.intent !== 'outfit') return 'answer';
        return s.occasion || s.understanding.enoughToSuggest
          ? 'retrieve-wardrobe'
          : 'clarify';
      },
      ['answer', 'retrieve-wardrobe', 'clarify'],
    )
    .addEdge('retrieve-wardrobe', 'compose')
    .addEdge('compose', 'check-rules')
    .addEdge('check-rules', 'write')
    .addEdge('write', END)
    .addEdge('answer', END)
    .addEdge('clarify', END);
  return graph.compile();
}

export type StylistGraph = ReturnType<typeof buildStylistGraph>;
