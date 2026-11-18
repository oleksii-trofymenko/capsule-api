import request from 'supertest';
import { FakeProvider } from '../support/fake-provider.js';
import {
  ScriptedChatModel,
  textChunks,
  toolCallChunk,
  type ScriptStep,
} from '../support/scripted-model.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('Stylist traces', () => {
  let t: TestApp;
  // The scripted model reads this array as the test appends to it.
  let script: ScriptStep[];
  const http = () => request(t.app.getHttpServer());
  const missingId = '00000000-0000-4000-8000-000000000000';

  beforeEach(async () => {
    script = [];
    t = await createTestApp(
      {},
      new FakeProvider([], new ScriptedChatModel(script)),
    );
  });
  afterEach(() => t.close());

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/v1/auth/register')
      .send({ email, password: 'a-long-password' })
      .expect(201);
    return res.body.accessToken;
  }

  /** Asks a question and returns the trace id from the done event. */
  async function ask(token: string, content: string, remember: object[] = []) {
    script.push(
      [
        toolCallChunk('understanding', {
          intent: 'question',
          enoughToSuggest: true,
          remember,
        }),
      ],
      textChunks('You have nothing yet.'),
    );
    const res = await http()
      .post('/v1/stylist/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ messages: [{ role: 'user', content }] })
      .expect(200);
    const done = res.text
      .split('\n\n')
      .find((b) => b.startsWith('event: done'));
    return (JSON.parse(done?.split('data: ')[1] ?? '{}') as { traceId: string })
      .traceId;
  }

  const trace = (token: string, id: string) =>
    http()
      .get(`/v1/stylist/traces/${id}`)
      .set('Authorization', `Bearer ${token}`);

  it('opens an answer to show its steps, prompts and outputs', async () => {
    const ana = await signUp('ana@example.com');
    const id = await ask(ana, 'Which shoes do I own?');

    const body = (await trace(ana, id).expect(200)).body;
    expect(body).toMatchObject({
      id,
      steps: ['load-context', 'understand', 'answer'],
      occasion: null,
      failed: false,
    });
    expect(body.calls.map((c: { step: string }) => c.step)).toEqual([
      'understand',
      'answer',
    ]);
    expect(body.calls[1]).toMatchObject({
      output: 'You have nothing yet.',
      failed: false,
    });
    expect(body.calls[1].messages.at(-1)).toEqual({
      role: 'human',
      text: 'Which shoes do I own?',
    });
  });

  it("does not let one user open another user's trace", async () => {
    const ana = await signUp('ana@example.com');
    const ben = await signUp('ben@example.com');
    const id = await ask(ana, 'Which shoes do I own?');

    await trace(ben, id).expect(404);
    await trace(ana, id).expect(200);
  });

  it('wipes traces when the person forgets a note, so the note leaves no copy behind', async () => {
    const ana = await signUp('ana@example.com');
    const id = await ask(ana, 'I never wear navy.', [
      { kind: 'dislike', text: 'navy' },
    ]);
    const [note] = (
      await http()
        .get('/v1/memory')
        .set('Authorization', `Bearer ${ana}`)
        .expect(200)
    ).body.notes;

    await http()
      .delete(`/v1/memory/${note.id}`)
      .set('Authorization', `Bearer ${ana}`)
      .expect(204);
    await trace(ana, id).expect(404);

    const next = await ask(ana, 'Which shoes do I own?');
    await http()
      .delete('/v1/memory')
      .set('Authorization', `Bearer ${ana}`)
      .expect(204);
    await trace(ana, next).expect(404);
  });

  it('requires a token, a uuid and an existing trace', async () => {
    const ana = await signUp('ana@example.com');
    await http().get(`/v1/stylist/traces/${missingId}`).expect(401);
    await trace(ana, 'not-a-uuid').expect(400);
    await trace(ana, missingId).expect(404);
  });
});
