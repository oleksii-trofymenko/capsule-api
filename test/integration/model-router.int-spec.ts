import { parseEnv } from '../../src/config/env.js';
import { MetricsService } from '../../src/metrics/metrics.service.js';
import { ModelRouter } from '../../src/models/model-router.service.js';
import { TEST_ENV } from '../support/env.js';
import { FakeProvider } from '../support/fake-provider.js';

describe('ModelRouter', () => {
  it('routes each task to the configured provider and model', () => {
    const env = parseEnv({
      ...TEST_ENV,
      MODEL_REASONING: 'ollama:gpt-oss:20b',
    });
    const router = new ModelRouter(
      env,
      [new FakeProvider()],
      new MetricsService(),
    );
    expect(router.describe()).toEqual({
      vision: { provider: 'ollama', model: 'gemma4:12b' },
      reasoning: { provider: 'ollama', model: 'gpt-oss:20b' },
      embedding: { provider: 'ollama', model: 'nomic-embed-text' },
    });
  });

  it('fails at construction when a task points at an unregistered provider', () => {
    const env = parseEnv({ ...TEST_ENV, MODEL_VISION: 'anthropic:some-model' });
    expect(
      () => new ModelRouter(env, [new FakeProvider()], new MetricsService()),
    ).toThrow(
      /MODEL_VISION uses unknown provider "anthropic" \(registered: ollama\)/,
    );
  });

  it('reuses one model instance per task', () => {
    const router = new ModelRouter(
      parseEnv(TEST_ENV),
      [new FakeProvider()],
      new MetricsService(),
    );
    expect(router.chat('vision')).toBe(router.chat('vision'));
    expect(router.chat('vision')).not.toBe(router.chat('reasoning'));
  });

  it('records a metric for every model call, labelled by task and model', async () => {
    const metrics = new MetricsService();
    const router = new ModelRouter(
      parseEnv(TEST_ENV),
      [new FakeProvider(['a navy blazer'])],
      metrics,
    );

    const reply = await router
      .chat('reasoning')
      .invoke('What goes with grey trousers?');
    expect(reply.content).toBe('a navy blazer');

    const text = await metrics.registry.metrics();
    expect(text).toContain(
      'llm_requests_total{task="reasoning",provider="ollama",model="gemma4:12b",outcome="success"} 1',
    );
    expect(text).toMatch(
      /llm_request_duration_seconds_count\{[^}]*task="reasoning"[^}]*\} 1/,
    );
    expect(text).not.toContain('task="vision"');
  });

  it('records embedding calls too, labelled as the embedding task', async () => {
    const metrics = new MetricsService();
    const router = new ModelRouter(
      parseEnv(TEST_ENV),
      [new FakeProvider()],
      metrics,
    );

    await router.embeddings().embedQuery('navy blazer');
    await router.embeddings().embedDocuments(['grey trousers', 'brogues']);

    const text = await metrics.registry.metrics();
    expect(text).toContain(
      'llm_requests_total{task="embedding",provider="ollama",model="nomic-embed-text",outcome="success"} 2',
    );
    expect(text).toMatch(
      /llm_request_duration_seconds_count\{[^}]*task="embedding"[^}]*outcome="success"[^}]*\} 2/,
    );
  });

  it('reports provider health once per provider in use', async () => {
    const router = new ModelRouter(
      parseEnv(TEST_ENV),
      [new FakeProvider()],
      new MetricsService(),
    );
    expect(await router.health()).toEqual({
      ollama: { ok: true, detail: 'fake' },
    });
  });
});
