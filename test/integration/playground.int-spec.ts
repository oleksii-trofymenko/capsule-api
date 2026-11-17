import { ToolMessage } from '@langchain/core/messages';
import { parseEnv } from '../../src/config/env.js';
import { MetricsService } from '../../src/metrics/metrics.service.js';
import { ModelRouter } from '../../src/models/model-router.service.js';
import type {
  ChatEvent,
  ChatRequest,
} from '../../src/playground/playground.schemas.js';
import { PlaygroundService } from '../../src/playground/playground.service.js';
import { TEST_ENV } from '../support/env.js';
import { FakeProvider } from '../support/fake-provider.js';
import {
  ScriptedChatModel,
  textChunks,
  toolCallChunk,
  type ScriptStep,
} from '../support/scripted-model.js';

function setup(script: ScriptStep[], fallback?: ScriptStep) {
  const model = new ScriptedChatModel(script, fallback);
  const router = new ModelRouter(
    parseEnv(TEST_ENV),
    [new FakeProvider([], model)],
    new MetricsService(),
  );
  return { model, service: new PlaygroundService(router) };
}

async function run(
  service: PlaygroundService,
  request: Partial<ChatRequest> = {},
) {
  const events: ChatEvent[] = [];
  const full = {
    messages: [{ role: 'user' as const, content: 'Hello' }],
    tools: true,
    ...request,
  };
  for await (const event of service.chat(full)) events.push(event);
  return events;
}

const ofType = <T extends ChatEvent['type']>(events: ChatEvent[], type: T) =>
  events.filter((e): e is Extract<ChatEvent, { type: T }> => e.type === type);

describe('PlaygroundService', () => {
  it('streams a plain answer token by token and reports timings', async () => {
    const { service } = setup([textChunks('A navy ', 'blazer ', 'works.')]);
    const events = await run(service);

    expect(events.map((e) => e.type)).toEqual([
      'start',
      'token',
      'token',
      'token',
      'done',
    ]);
    expect(
      ofType(events, 'token')
        .map((e) => e.text)
        .join(''),
    ).toBe('A navy blazer works.');
    expect(events[0]).toMatchObject({
      provider: 'ollama',
      model: 'gemma4:12b',
      tools: ['get_today', 'search_wardrobe', 'get_dress_code'],
    });
    const done = ofType(events, 'done')[0];
    expect(done.modelCalls).toBe(1);
    expect(done.firstTokenMs).not.toBeNull();
    expect(done.ms).toBeGreaterThanOrEqual(done.firstTokenMs!);
  });

  it('runs a requested tool and gives its result back to the model', async () => {
    const { service, model } = setup([
      [
        toolCallChunk(
          'get_dress_code',
          { occasion: 'wedding guest' },
          'call_1',
        ),
      ],
      textChunks('Avoid white.'),
    ]);
    const events = await run(service);

    expect(events.map((e) => e.type)).toEqual([
      'start',
      'tool_call',
      'tool_result',
      'token',
      'done',
    ]);
    expect(ofType(events, 'tool_call')[0]).toMatchObject({
      id: 'call_1',
      name: 'get_dress_code',
      args: { occasion: 'wedding guest' },
    });
    const result = ofType(events, 'tool_result')[0];
    expect(result).toMatchObject({ id: 'call_1', ok: true });
    expect(result.result).toContain('Do not wear white');

    // The second model call must have seen the tool's output, linked to the call.
    const lastSent = model.received[1].at(-1);
    expect(lastSent).toBeInstanceOf(ToolMessage);
    expect((lastSent as ToolMessage).tool_call_id).toBe('call_1');
    expect(lastSent!.text).toContain('Do not wear white');
    expect(ofType(events, 'done')[0].modelCalls).toBe(2);
  });

  it('reports an unknown tool as a failed result and lets the model continue', async () => {
    const { service, model } = setup([
      [toolCallChunk('order_pizza', { size: 'large' })],
      textChunks('I cannot do that.'),
    ]);
    const events = await run(service);

    expect(ofType(events, 'tool_result')[0]).toMatchObject({
      ok: false,
      result: 'Tool failed: Unknown tool "order_pizza"',
    });
    expect(model.received[1].at(-1)!.text).toContain('Unknown tool');
    expect(events.at(-1)!.type).toBe('done');
  });

  it('reports invalid tool arguments as a failed result', async () => {
    const { service } = setup([
      [toolCallChunk('search_wardrobe', { category: 'hats' })],
      textChunks('Let me try again.'),
    ]);
    const result = ofType(await run(service), 'tool_result')[0];
    expect(result.ok).toBe(false);
    expect(result.result).toMatch(/^Tool failed: /);
  });

  it('offers the model no tools when they are switched off', async () => {
    const { service, model } = setup([textChunks('No tools here.')]);
    const events = await run(service, { tools: false });
    expect(ofType(events, 'start')[0].tools).toEqual([]);
    expect(model.boundTools).toBeNull();
  });

  it('stops a model that never stops calling tools', async () => {
    const { service, model } = setup([], [toolCallChunk('get_today', {})]);
    const events = await run(service);
    expect(model.received).toHaveLength(6);
    expect(ofType(events, 'tool_result')).toHaveLength(6);
    expect(ofType(events, 'done')[0].modelCalls).toBe(6);
  });

  it('sends the default system prompt first, or the override when one is given', async () => {
    const a = setup([textChunks('ok')]);
    await run(a.service);
    expect(a.model.received[0][0].getType()).toBe('system');
    expect(a.model.received[0][0].text).toContain('You are Capsule');

    const b = setup([textChunks('ok')]);
    const events = await run(b.service, {
      systemPrompt: '  Answer only in haiku.  ',
    });
    expect(b.model.received[0][0].text).toBe('Answer only in haiku.');
    expect(ofType(events, 'start')[0].systemPrompt).toBe(
      'Answer only in haiku.',
    );
  });

  it('passes earlier turns to the model in order', async () => {
    const { service, model } = setup([textChunks('ok')]);
    await run(service, {
      messages: [
        { role: 'user', content: 'I have a wedding.' },
        { role: 'assistant', content: 'Daytime or evening?' },
        { role: 'user', content: 'Evening.' },
      ],
    });
    expect(model.received[0].map((m) => m.getType())).toEqual([
      'system',
      'human',
      'ai',
      'human',
    ]);
  });

  it('turns a model failure into an error event instead of throwing', async () => {
    const { service } = setup([
      new Error('model "gemma4:12b" not found, try pulling it first'),
    ]);
    const events = await run(service);
    expect(events.at(-1)).toEqual({
      type: 'error',
      message: 'model "gemma4:12b" not found, try pulling it first',
    });
  });
});
