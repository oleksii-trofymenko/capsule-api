import request from 'supertest';
import { FakeProvider } from '../support/fake-provider.js';
import {
  ScriptedChatModel,
  textChunks,
  toolCallChunk,
} from '../support/scripted-model.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('Stylist API', () => {
  let t: TestApp;
  let model: ScriptedChatModel;
  const http = () => request(t.app.getHttpServer());

  beforeEach(async () => {
    model = new ScriptedChatModel([
      [
        toolCallChunk('understanding', {
          intent: 'question',
          enoughToSuggest: true,
        }),
      ],
      textChunks('You own a navy wool blazer.'),
    ]);
    t = await createTestApp({}, new FakeProvider([], model));
  });
  afterEach(() => t.close());

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/v1/auth/register')
      .send({ email, password: 'a-long-password' })
      .expect(201);
    return res.body.accessToken;
  }

  const ask = (token: string, content: string) =>
    http()
      .post('/v1/stylist/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ messages: [{ role: 'user', content }] });

  it("streams the reply, built from the signed-in user's own wardrobe", async () => {
    const ana = await signUp('ana@example.com');
    const ben = await signUp('ben@example.com');
    await http()
      .post('/v1/wardrobe/items')
      .set('Authorization', `Bearer ${ana}`)
      .send({
        name: 'Navy wool blazer',
        category: 'outerwear',
        colour: 'navy',
        formality: 'formal',
        seasons: ['autumn', 'winter'],
      })
      .expect(201);
    await http()
      .post('/v1/wardrobe/items')
      .set('Authorization', `Bearer ${ben}`)
      .send({
        name: 'Red sequin dress',
        category: 'dress',
        colour: 'red',
        formality: 'formal',
        seasons: ['winter'],
      })
      .expect(201);

    const res = await ask(ana, 'What jackets do I own?').expect(200);

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: step\ndata: {"step":"load-context"}');
    expect(res.text).toContain(
      'event: token\ndata: {"text":"You own a navy wool blazer."}',
    );
    expect(res.text).toContain('event: done');
    // The model saw Ana's wardrobe and nothing of Ben's.
    const prompt = model.received[1][0].text;
    expect(prompt).toContain('Navy wool blazer');
    expect(prompt).not.toContain('Red sequin dress');
  });

  it('requires a token', async () => {
    await http()
      .post('/v1/stylist/chat')
      .send({ messages: [{ role: 'user', content: 'Hi' }] })
      .expect(401);
  });

  it.each([
    ['a missing body', undefined],
    ['no messages', { messages: [] }],
    [
      'a last message from the assistant',
      { messages: [{ role: 'assistant', content: 'Hi' }] },
    ],
    ['an empty message', { messages: [{ role: 'user', content: '' }] }],
  ])('rejects %s with 400', async (_name, body) => {
    const token = await signUp('ana@example.com');
    await http()
      .post('/v1/stylist/chat')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(400);
  });
});
