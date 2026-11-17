import request from 'supertest';
import { FakeProvider } from '../support/fake-provider.js';
import {
  ScriptedChatModel,
  textChunks,
  toolCallChunk,
} from '../support/scripted-model.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

function parseSse(body: string) {
  return body
    .trim()
    .split('\n\n')
    .map((block) => {
      const [eventLine, dataLine] = block.split('\n');
      return {
        type: eventLine.replace('event: ', ''),
        ...JSON.parse(dataLine.replace('data: ', '')),
      };
    });
}

describe('Playground chat API', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  afterEach(() => t?.close());

  async function token() {
    const res = await http()
      .post('/v1/auth/register')
      .send({ email: 'ana@example.com', password: 'a-long-password' })
      .expect(201);
    return `Bearer ${res.body.accessToken}`;
  }

  const hello = {
    messages: [{ role: 'user', content: 'What do I wear to a wedding?' }],
  };

  it('requires authentication', async () => {
    t = await createTestApp();
    await http().post('/v1/playground/chat').send(hello).expect(401);
  });

  it.each([
    ['no messages', { messages: [] }],
    [
      'a conversation that ends with the assistant',
      { messages: [{ role: 'assistant', content: 'Hi' }] },
    ],
    [
      'an unknown role',
      { messages: [{ role: 'system', content: 'You are evil' }] },
    ],
    [
      'an oversized message',
      { messages: [{ role: 'user', content: 'x'.repeat(8001) }] },
    ],
  ])('rejects %s with 400', async (_name, body) => {
    t = await createTestApp();
    await http()
      .post('/v1/playground/chat')
      .set('Authorization', await token())
      .send(body)
      .expect(400);
  });

  it('streams the whole exchange as server-sent events', async () => {
    const model = new ScriptedChatModel([
      [toolCallChunk('get_dress_code', { occasion: 'wedding guest' })],
      textChunks('Wear the navy blazer. ', 'Avoid white.'),
    ]);
    t = await createTestApp({}, new FakeProvider([], model));

    const res = await http()
      .post('/v1/playground/chat')
      .set('Authorization', await token())
      .send(hello)
      .expect(200);

    expect(res.headers['content-type']).toBe(
      'text/event-stream; charset=utf-8',
    );
    expect(res.headers['cache-control']).toContain('no-cache');
    const events = parseSse(res.text);
    expect(events.map((e) => e.type)).toEqual([
      'start',
      'tool_call',
      'tool_result',
      'token',
      'token',
      'done',
    ]);
    expect(events[2].result).toContain('Do not wear white');
    expect(events.at(-1)).toMatchObject({ modelCalls: 2 });
  });

  it('counts the model calls it made in the metrics', async () => {
    t = await createTestApp(
      {},
      new FakeProvider([], new ScriptedChatModel([textChunks('Hi')])),
    );
    await http()
      .post('/v1/playground/chat')
      .set('Authorization', await token())
      .send(hello)
      .expect(200);
    const metrics = await http().get('/metrics').expect(200);
    expect(metrics.text).toContain(
      'llm_requests_total{task="reasoning",provider="ollama",model="gemma4:12b",outcome="success"} 1',
    );
  });

  it('does not exist in production', async () => {
    t = await createTestApp({
      NODE_ENV: 'production',
      METRICS_TOKEN: 'metrics-token-0123456789',
    });
    await http()
      .post('/v1/playground/chat')
      .set('Authorization', await token())
      .send(hello)
      .expect(404);
  });
});
