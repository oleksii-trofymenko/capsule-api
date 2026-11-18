import request from 'supertest';
import { FakeProvider } from '../support/fake-provider.js';
import {
  ScriptedChatModel,
  textChunks,
  toolCallChunk,
  type ScriptStep,
} from '../support/scripted-model.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('Personal memory', () => {
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

  async function addItem(token: string, name: string, colour: string) {
    const res = await http()
      .post('/v1/wardrobe/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        category: name.includes('blazer') ? 'outerwear' : 'bottom',
        colour,
        formality: 'smart',
        seasons: ['autumn'],
      })
      .expect(201);
    return res.body.id as string;
  }

  /** One conversation, one message: the model's reading of it is scripted. */
  async function chat(
    token: string,
    content: string,
    remember: object[],
    pick: string[],
  ) {
    script.push(
      [
        toolCallChunk('understanding', {
          intent: 'outfit',
          enoughToSuggest: true,
          remember,
        }),
      ],
      [toolCallChunk('outfit', { itemIds: pick, missing: null })],
      textChunks('Here you go.'),
    );
    const res = await http()
      .post('/v1/stylist/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ messages: [{ role: 'user', content }] })
      .expect(200);
    const block = res.text
      .split('\n\n')
      .find((b) => b.startsWith('event: outfit'));
    return JSON.parse(block?.split('data: ')[1] ?? 'null') as {
      items: { id: string; name: string }[];
    };
  }

  const notes = (token: string) =>
    http().get('/v1/memory').set('Authorization', `Bearer ${token}`);

  it('respects a dislike stated in an earlier conversation, until it is deleted', async () => {
    const ana = await signUp('ana@example.com');
    const blazer = await addItem(ana, 'Navy wool blazer', 'navy');
    const trousers = await addItem(ana, 'Grey wool trousers', 'grey');

    await chat(
      ana,
      'I never wear navy. Office outfit?',
      [{ kind: 'dislike', text: 'navy' }],
      [trousers],
    );
    const stored = (await notes(ana).expect(200)).body.notes;
    expect(stored).toEqual([
      {
        id: expect.any(String),
        kind: 'dislike',
        text: 'navy',
        createdAt: expect.any(String),
      },
    ]);

    // A new conversation: the model picks the blazer anyway, and code keeps it out.
    const next = await chat(
      ana,
      'Office outfit for Monday?',
      [],
      [blazer, trousers],
    );
    expect(next.items.map((i) => i.id)).toEqual([trousers]);

    await http()
      .delete(`/v1/memory/${stored[0].id}`)
      .set('Authorization', `Bearer ${ana}`)
      .expect(204);
    expect((await notes(ana).expect(200)).body.notes).toEqual([]);
    const after = await chat(ana, 'Office outfit?', [], [blazer, trousers]);
    expect(after.items.map((i) => i.id)).toEqual([blazer, trousers]);
  });

  it('forgets everything at once, and keeps one note when told the same thing twice', async () => {
    const ana = await signUp('ana@example.com');
    const trousers = await addItem(ana, 'Grey wool trousers', 'grey');
    await chat(
      ana,
      'I love green and wear UK 12.',
      [
        { kind: 'like', text: 'Green' },
        { kind: 'fact', text: 'wears UK 12' },
      ],
      [trousers],
    );
    await chat(
      ana,
      'Green is my colour.',
      [{ kind: 'like', text: 'green' }],
      [trousers],
    );
    expect((await notes(ana).expect(200)).body.notes).toHaveLength(2);

    await http()
      .delete('/v1/memory')
      .set('Authorization', `Bearer ${ana}`)
      .expect(204);
    expect((await notes(ana).expect(200)).body.notes).toEqual([]);
  });

  it("does not let one user see or delete another user's notes", async () => {
    const ana = await signUp('ana@example.com');
    const ben = await signUp('ben@example.com');
    const trousers = await addItem(ana, 'Grey wool trousers', 'grey');
    await chat(
      ana,
      'No navy, please.',
      [{ kind: 'dislike', text: 'navy' }],
      [trousers],
    );
    const [note] = (await notes(ana).expect(200)).body.notes;

    expect((await notes(ben).expect(200)).body.notes).toEqual([]);
    await http()
      .delete(`/v1/memory/${note.id}`)
      .set('Authorization', `Bearer ${ben}`)
      .expect(404);
    await http()
      .delete('/v1/memory')
      .set('Authorization', `Bearer ${ben}`)
      .expect(204);
    expect((await notes(ana).expect(200)).body.notes).toHaveLength(1);
  });

  it('requires a token', async () => {
    await http().get('/v1/memory').expect(401);
    await http().delete(`/v1/memory/${missingId}`).expect(401);
    await http().delete('/v1/memory').expect(401);
  });

  it('rejects a note id that is not a uuid with 400, and an unknown one with 404', async () => {
    const ana = await signUp('ana@example.com');
    await http()
      .delete('/v1/memory/not-a-uuid')
      .set('Authorization', `Bearer ${ana}`)
      .expect(400);
    await http()
      .delete(`/v1/memory/${missingId}`)
      .set('Authorization', `Bearer ${ana}`)
      .expect(404);
  });
});
