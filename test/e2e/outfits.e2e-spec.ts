import request from 'supertest';
import { FakeProvider } from '../support/fake-provider.js';
import {
  ScriptedChatModel,
  textChunks,
  toolCallChunk,
  type ScriptStep,
} from '../support/scripted-model.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('Outfit feedback', () => {
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

  async function addItem(token: string, name: string, category: string) {
    const res = await http()
      .post('/v1/wardrobe/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        category,
        colour: 'navy',
        formality: 'smart',
        seasons: ['autumn'],
      })
      .expect(201);
    return res.body.id as string;
  }

  /** Asks the stylist for an office outfit of these items and returns the saved outfit's id. */
  async function suggestOutfit(token: string, itemIds: string[]) {
    script.push(
      [
        toolCallChunk('understanding', {
          intent: 'outfit',
          enoughToSuggest: true,
        }),
      ],
      [toolCallChunk('outfit', { itemIds, missing: null })],
      textChunks('Wear these.'),
    );
    const res = await http()
      .post('/v1/stylist/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [{ role: 'user', content: 'Office outfit for Monday?' }],
      })
      .expect(200);
    const block = res.text
      .split('\n\n')
      .find((b) => b.startsWith('event: outfit'));
    const outfit = JSON.parse(block?.split('data: ')[1] ?? 'null');
    expect(outfit.id).toEqual(expect.any(String));
    return outfit.id as string;
  }

  const feedback = (token: string, id: string, body: object) =>
    http()
      .patch(`/v1/outfits/${id}/feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const profileFeedback = async (token: string) =>
    (
      await http()
        .get('/v1/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body.feedback;

  it('stores feedback on a suggested outfit and shows it in the profile', async () => {
    const ana = await signUp('ana@example.com');
    const blazer = await addItem(ana, 'Navy wool blazer', 'outerwear');
    const chinos = await addItem(ana, 'Navy chinos', 'bottom');
    const id = await suggestOutfit(ana, [blazer, chinos]);

    const res = await feedback(ana, id, {
      rating: 'like',
      worn: true,
      note: '  Comfortable all day  ',
    }).expect(200);
    expect(res.body).toMatchObject({
      id,
      occasionId: 'office',
      rating: 'like',
      worn: true,
      note: 'Comfortable all day',
      feedbackAt: expect.any(String),
    });

    expect(await profileFeedback(ana)).toEqual({
      liked: 1,
      disliked: 0,
      worn: 1,
      recent: [
        {
          outfitId: id,
          occasion: 'Office',
          items: ['Navy wool blazer', 'Navy chinos'],
          rating: 'like',
          worn: true,
          note: 'Comfortable all day',
          feedbackAt: expect.any(String),
        },
      ],
    });
  });

  it('lets later feedback replace earlier, and clears a rating with null', async () => {
    const ana = await signUp('ana@example.com');
    const blazer = await addItem(ana, 'Navy wool blazer', 'outerwear');
    const id = await suggestOutfit(ana, [blazer]);

    await feedback(ana, id, { rating: 'like', worn: true }).expect(200);
    await feedback(ana, id, { rating: 'dislike' }).expect(200);
    expect(await profileFeedback(ana)).toMatchObject({
      liked: 0,
      disliked: 1,
      worn: 1,
    });

    await feedback(ana, id, { rating: null }).expect(200);
    expect(await profileFeedback(ana)).toMatchObject({
      liked: 0,
      disliked: 0,
      recent: [{ rating: null, worn: true }],
    });
  });

  it("does not let one user see or rate another user's outfit", async () => {
    const ana = await signUp('ana@example.com');
    const ben = await signUp('ben@example.com');
    const blazer = await addItem(ana, 'Navy wool blazer', 'outerwear');
    const id = await suggestOutfit(ana, [blazer]);
    await feedback(ana, id, { rating: 'like' }).expect(200);

    await feedback(ben, id, { rating: 'dislike' }).expect(404);
    await feedback(ben, missingId, { rating: 'like' }).expect(404);
    expect(await profileFeedback(ben)).toEqual({
      liked: 0,
      disliked: 0,
      worn: 0,
      recent: [],
    });
    expect(await profileFeedback(ana)).toMatchObject({ liked: 1 });
  });

  it('requires a token', async () => {
    await http()
      .patch(`/v1/outfits/${missingId}/feedback`)
      .send({ rating: 'like' })
      .expect(401);
  });

  it.each([
    ['an empty body', {}],
    ['an unknown rating', { rating: 'love' }],
    ['a worn flag that is not a boolean', { worn: 'yes' }],
    ['a note over 500 characters', { note: 'x'.repeat(501) }],
  ])('rejects %s with 400', async (_name, body) => {
    const ana = await signUp('ana@example.com');
    await feedback(ana, missingId, body).expect(400);
  });

  it('rejects an outfit id that is not a uuid with 400', async () => {
    const ana = await signUp('ana@example.com');
    await feedback(ana, 'outfit-1', { rating: 'like' }).expect(400);
  });
});
