import type { BaseMessage } from '@langchain/core/messages';
import { parseEnv } from '../../src/config/env.js';
import { MetricsService } from '../../src/metrics/metrics.service.js';
import { ModelRouter } from '../../src/models/model-router.service.js';
import { readLibrary } from '../../src/occasions/load-occasions.js';
import { OccasionsService } from '../../src/occasions/occasions.service.js';
import type { NewNote } from '../../src/memory/memory.schemas.js';
import type { NewOutfit } from '../../src/outfits/outfit-store.js';
import type { NewTrace } from '../../src/traces/traces.schemas.js';
import type { ProfileAnswers } from '../../src/profile/profile.schemas.js';
import { sampleWardrobe } from '../../src/playground/sample-data.js';
import { stylistPrompts } from '../../src/stylist/stylist.prompts.js';
import type {
  StylistChatRequest,
  StylistEvent,
} from '../../src/stylist/stylist.schemas.js';
import { StylistService } from '../../src/stylist/stylist.service.js';
import { TEST_ENV } from '../support/env.js';
import { FakeProvider } from '../support/fake-provider.js';
import {
  ScriptedChatModel,
  textChunks,
  toolCallChunk,
  type ScriptStep,
} from '../support/scripted-model.js';

const occasions = new OccasionsService(readLibrary());
const NOW = new Date('2026-11-17T12:00:00Z');

function setup(
  script: ScriptStep[],
  notes: NewNote[] = [],
  profile: ProfileAnswers | null = null,
) {
  const model = new ScriptedChatModel(script);
  const router = new ModelRouter(
    parseEnv(TEST_ENV),
    [new FakeProvider([], model)],
    new MetricsService(),
  );
  const saved: NewOutfit[] = [];
  const remembered: NewNote[] = [];
  const traces: NewTrace[] = [];
  const stylist = new StylistService(
    router,
    occasions,
    { load: async () => ({ wardrobe: sampleWardrobe, profile, notes }) },
    {
      save: async (_userId, outfit) => {
        saved.push(outfit);
        return `outfit-${saved.length}`;
      },
    },
    { add: async (_userId, added) => void remembered.push(...added) },
    {
      save: async (_userId, trace) => {
        traces.push(trace);
        return `trace-${traces.length}`;
      },
    },
  );
  return { model, stylist, saved, remembered, traces };
}

async function run(stylist: StylistService, ...turns: string[]) {
  const messages: StylistChatRequest['messages'] = turns.map((content, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content,
  }));
  const events: StylistEvent[] = [];
  for await (const e of stylist.chat('user-1', { messages }, undefined, NOW)) {
    events.push(e);
  }
  return events;
}

const steps = (events: StylistEvent[]) =>
  events.flatMap((e) => (e.type === 'step' ? [e.step] : []));
const reply = (events: StylistEvent[]) =>
  events.map((e) => (e.type === 'token' ? e.text : '')).join('');
const systemText = (call: BaseMessage[]) => call[0].text;

const understood = (intent: 'outfit' | 'question', enoughToSuggest = true) => [
  toolCallChunk('understanding', { intent, enoughToSuggest }),
];
const picked = (itemIds: string[], missing: string | null = null) => [
  toolCallChunk('outfit', { itemIds, missing }),
];

describe('Stylist graph', () => {
  it('builds an outfit for a known occasion from allowed, owned items only', async () => {
    const { model, stylist, saved } = setup([
      understood('outfit'),
      picked(['w08', 'w01', 'w06', 'w12', 'w99']),
      textChunks('Navy wool blazer, ', 'white shirt.'),
    ]);
    const events = await run(stylist, 'What should I wear to a wedding?');

    // The outfit is saved as a snapshot so feedback can attach to it.
    expect(saved).toEqual([
      {
        occasionId: 'wedding-guest',
        items: [
          { itemId: 'w08', name: 'Navy wool blazer' },
          { itemId: 'w01', name: 'White cotton shirt' },
          { itemId: 'w06', name: 'Charcoal wool trousers' },
          { itemId: 'w12', name: 'Brown leather brogues' },
        ],
      },
    ]);

    expect(steps(events)).toEqual([
      'load-context',
      'understand',
      'retrieve-wardrobe',
      'compose',
      'check-rules',
      'write',
    ]);
    const outfit = events.find((e) => e.type === 'outfit');
    expect(outfit).toEqual({
      type: 'outfit',
      id: 'outfit-1',
      occasion: 'wedding-guest',
      items: [
        { id: 'w08', name: 'Navy wool blazer' },
        { id: 'w01', name: 'White cotton shirt' },
        { id: 'w06', name: 'Charcoal wool trousers' },
        { id: 'w12', name: 'Brown leather brogues' },
      ],
      removed: [],
      missing: null,
    });
    expect(reply(events)).toBe('Navy wool blazer, white shirt.');
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      consulted: ['wardrobe', 'date', 'dress-code'],
    });

    const [, compose, write] = model.received.map(systemText);
    // The wedding rules removed jeans and trainers before the model chose.
    expect(compose).toContain('w08: Navy wool blazer');
    expect(compose).not.toContain('Dark indigo straight jeans');
    expect(compose).not.toContain('White leather trainers');
    expect(compose).toContain('Wedding guest');
    // The writer sees names, never ids.
    expect(write).toContain('Navy wool blazer');
    expect(write).not.toMatch(/\bw\d{2}\b/);
  });

  it('retries once when the outfit breaks a rule, then drops the item and says why', async () => {
    const shirtAsMainColour = ['w01', 'w06', 'w12'];
    const { model, stylist } = setup([
      understood('outfit'),
      picked(shirtAsMainColour),
      picked(shirtAsMainColour),
      textChunks('Here is a start.'),
    ]);
    const events = await run(stylist, 'Outfit for a wedding on Saturday?');

    const outfit = events.find((e) => e.type === 'outfit');
    expect(outfit).toMatchObject({
      items: [
        { name: 'Charcoal wool trousers' },
        { name: 'Brown leather brogues' },
      ],
      removed: [
        {
          name: 'White cotton shirt',
          reason: 'Do not wear white, ivory or cream as the main colour.',
        },
      ],
    });
    // The retry told the model which rule it broke.
    expect(systemText(model.received[2])).toContain(
      'White cotton shirt: Do not wear white',
    );
    expect(systemText(model.received[3])).toContain(
      'White cotton shirt: Do not wear white',
    );
  });

  it('still replies when the database is down, with no outfit or trace id', async () => {
    const model = new ScriptedChatModel([
      understood('outfit'),
      picked(['w08', 'w06']),
      textChunks('Blazer and trousers.'),
    ]);
    const router = new ModelRouter(
      parseEnv(TEST_ENV),
      [new FakeProvider([], model)],
      new MetricsService(),
    );
    const stylist = new StylistService(
      router,
      occasions,
      {
        load: async () => ({
          wardrobe: sampleWardrobe,
          profile: null,
          notes: [],
        }),
      },
      {
        save: async () => {
          throw new Error('database down');
        },
      },
      {
        add: async () => {
          throw new Error('database down');
        },
      },
      {
        save: async () => {
          throw new Error('database down');
        },
      },
    );
    const events = await run(stylist, 'Office outfit for Monday?');

    expect(events.find((e) => e.type === 'outfit')).toMatchObject({
      id: null,
      items: [{ id: 'w08' }, { id: 'w06' }],
    });
    expect(reply(events)).toBe('Blazer and trousers.');
    expect(events.at(-1)).toMatchObject({ type: 'done', traceId: null });
  });

  it('tries compose again after invalid output, and reads "null" as nothing missing', async () => {
    const { model, stylist } = setup([
      understood('outfit'),
      textChunks('Sure! Here is an outfit.'),
      picked(['w08', 'w06'], 'null'),
      textChunks('Blazer and trousers.'),
    ]);
    const events = await run(stylist, 'Office outfit for Monday?');

    expect(events.find((e) => e.type === 'outfit')).toMatchObject({
      items: [{ id: 'w08' }, { id: 'w06' }],
      missing: null,
    });
    expect(systemText(model.received[3])).not.toContain('Missing');
  });

  it('asks one question when an outfit request gives nothing to go on', async () => {
    const { model, stylist, saved } = setup([understood('outfit', false)]);
    const events = await run(stylist, "I'm going out.");

    expect(steps(events)).toEqual(['load-context', 'understand', 'clarify']);
    expect(reply(events)).toBe(stylistPrompts.en.clarify);
    expect(model.received).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: 'done', consulted: [] });
    expect(saved).toEqual([]);
  });

  it('keeps what the person says about themselves, and leaves out a dislike at once', async () => {
    const { model, stylist, remembered } = setup([
      [
        toolCallChunk('understanding', {
          intent: 'outfit',
          enoughToSuggest: true,
          remember: [
            { kind: 'dislike', text: 'navy' },
            { kind: 'like', text: 'x'.repeat(500) },
            { kind: 'opinion', text: 'boots' },
            { kind: 'fact', text: 'wears UK 12 in dresses' },
          ],
        }),
      ],
      picked(['w06', 'w01']),
      textChunks('Trousers and shirt.'),
    ]);
    await run(stylist, 'I never wear navy. Something for the office?');

    // Invalid notes from the model are dropped; the valid ones are kept.
    expect(remembered).toEqual([
      { kind: 'dislike', text: 'navy' },
      { kind: 'fact', text: 'wears UK 12 in dresses' },
    ]);
    const compose = systemText(model.received[1]);
    expect(compose).not.toContain('Navy wool blazer');
    expect(compose).not.toContain('Navy merino');
    expect(compose).toContain('Charcoal wool trousers');
  });

  it('keeps nothing from a one-off reaction, even when the model notes it', async () => {
    const { model, stylist, remembered } = setup([
      [
        toolCallChunk('understanding', {
          intent: 'outfit',
          enoughToSuggest: true,
          remember: [{ kind: 'dislike', text: 'blazers' }],
        }),
      ],
      picked(['w02', 'w06']),
      textChunks('Jumper and trousers.'),
    ]);
    await run(
      stylist,
      'Something smart for Friday drinks?',
      'Navy wool blazer, white cotton shirt and charcoal wool trousers.',
      'That felt too stiff. It was the blazer.',
    );

    expect(remembered).toEqual([]);
    // Within this conversation the model handles the blazer; code bans nothing.
    expect(systemText(model.received[1])).toContain('Navy wool blazer');
  });

  it('remembers earlier conversations: notes reach the prompt and dislikes leave the candidates', async () => {
    const { model, stylist, remembered } = setup(
      [
        understood('outfit'),
        picked(['w06', 'w01']),
        textChunks('Trousers and shirt.'),
      ],
      [
        { kind: 'dislike', text: 'navy' },
        { kind: 'like', text: 'earth tones' },
      ],
    );
    await run(stylist, 'Something for the office?');

    const compose = systemText(model.received[1]);
    expect(compose).toContain(
      'What the person told us in earlier conversations:\n- Dislikes: navy\n- Likes: earth tones',
    );
    expect(compose).not.toContain('Navy wool blazer');
    expect(systemText(model.received[2])).toContain('Dislikes: navy');
    expect(remembered).toEqual([]);
  });

  it('answers a question with the whole wardrobe in view, by name', async () => {
    const { model, stylist, saved } = setup([
      understood('question'),
      textChunks('You own the Olive waxed jacket.'),
    ]);
    const events = await run(stylist, 'Do I own anything for rain?');

    expect(steps(events)).toEqual(['load-context', 'understand', 'answer']);
    expect(reply(events)).toBe('You own the Olive waxed jacket.');
    expect(saved).toEqual([]);
    const answer = systemText(model.received[1]);
    for (const item of sampleWardrobe) expect(answer).toContain(item.name);
    expect(answer).not.toMatch(/\bw\d{2}\b/);
    expect(events.at(-1)).toMatchObject({ consulted: ['wardrobe', 'date'] });
  });

  it('uses the earlier turns: the occasion can come from before the latest message', async () => {
    const { model, stylist } = setup([
      understood('outfit'),
      picked(['w02', 'w06', 'w12']),
      textChunks('Swap in the jumper.'),
    ]);
    await run(
      stylist,
      'Something for a funeral on Thursday?',
      'Charcoal wool trousers, navy wool blazer and black Chelsea boots.',
      'The blazer feels too stiff.',
    );
    expect(systemText(model.received[1])).toContain('Funeral');
    // The whole conversation reaches the model, not just the last message.
    expect(model.received[1].map((m) => m.text)).toContain(
      'The blazer feels too stiff.',
    );
  });

  it('answers instead of inventing an outfit when it cannot tell what is asked', async () => {
    const { stylist } = setup([
      textChunks('not json at all'),
      textChunks('Tell me a bit more?'),
    ]);
    const events = await run(stylist, 'Hmm.');
    expect(steps(events)).toEqual(['load-context', 'understand', 'answer']);
  });

  it('reports a failure without the details, and keeps a trace of it', async () => {
    const { stylist, traces } = setup([
      understood('question'),
      new Error('model crashed: secret internals'),
    ]);
    const events = await run(stylist, 'Which shoes do I own?');
    expect(events.at(-1)).toEqual({
      type: 'error',
      message: 'The stylist could not answer just now. Please try again.',
      traceId: 'trace-1',
    });

    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({ failed: true });
    expect(traces[0].calls.map((c) => [c.step, c.failed])).toEqual([
      ['understand', false],
      ['answer', true],
    ]);
    expect(JSON.stringify(traces[0])).not.toContain('secret internals');
  });

  it('keeps a trace of each answer: every model call with its step, prompt and output', async () => {
    const { model, stylist, traces } = setup([
      understood('outfit'),
      picked(['w08', 'w01']),
      textChunks('Navy wool blazer, ', 'white shirt.'),
    ]);
    const events = await run(stylist, 'What should I wear to a wedding?');

    expect(events.at(-1)).toMatchObject({ type: 'done', traceId: 'trace-1' });
    const [trace] = traces;
    expect(trace).toMatchObject({
      steps: [
        'load-context',
        'understand',
        'retrieve-wardrobe',
        'compose',
        'check-rules',
        'write',
      ],
      occasion: 'wedding-guest',
      outfit: ['Navy wool blazer', 'White cotton shirt'],
      failed: false,
    });
    expect(trace.candidates).toContain('Navy wool blazer');
    expect(trace.candidates).not.toContain('White leather trainers');

    expect(trace.calls.map((c) => c.step)).toEqual([
      'understand',
      'compose',
      'write',
    ]);
    // The prompts exactly as the model received them.
    expect(trace.calls.map((c) => c.messages.map((m) => m.text))).toEqual(
      model.received.map((call) => call.map((m) => m.text)),
    );
    expect(trace.calls[0].messages.at(-1)).toEqual({
      role: 'human',
      text: 'What should I wear to a wedding?',
    });
    expect(JSON.parse(trace.calls[1].output ?? '')).toEqual([
      { itemIds: ['w08', 'w01'], missing: null },
    ]);
    expect(trace.calls[2].output).toBe('Navy wool blazer, white shirt.');
  });

  describe('colouring and frame from the quiz', () => {
    const profile: ProfileAnswers = {
      sizes: { top: null, bottom: null, shoes: null },
      fit: 'regular',
      directions: ['classic'],
      favouriteColours: [],
      avoidColours: [],
      lifestyle: 'mixed',
      neverWear: [],
      colourTemperature: 'warm',
      colourContrast: 'high',
      height: 'petite',
      frame: ['longer-torso'],
      playUp: ['waist', 'legs'],
    };
    const outfitScript = () => [
      understood('outfit'),
      picked(['w06', 'w01']),
      textChunks('Trousers and shirt.'),
    ];

    it('reach the compose and write prompts with how to use them', async () => {
      const { model, stylist } = setup(outfitScript(), [], profile);
      await run(stylist, 'Something for the office?');

      const line =
        'colouring warm; high contrast; height petite; frame longer-torso; likes to show off waist, legs. ' +
        stylistPrompts.en.labels.selfUse;
      expect(systemText(model.received[1])).toContain(line);
      expect(systemText(model.received[2])).toContain(line);
    });

    it('leave no trace when every answer was skipped', async () => {
      const skipped: ProfileAnswers = {
        ...profile,
        colourTemperature: 'skip',
        colourContrast: 'skip',
        height: 'skip',
        frame: [],
        playUp: [],
      };
      const { model, stylist } = setup(outfitScript(), [], skipped);
      await run(stylist, 'Something for the office?');

      const compose = systemText(model.received[1]);
      expect(compose).toContain('What the person told us about themselves');
      expect(compose).not.toContain('colouring');
      expect(compose).not.toContain(stylistPrompts.en.labels.selfUse);
    });
  });
});
