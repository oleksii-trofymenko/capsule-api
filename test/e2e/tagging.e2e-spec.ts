import request from 'supertest';
import { FakeProvider } from '../support/fake-provider.js';
import {
  ScriptedChatModel,
  textChunks,
  toolCallChunk,
  type ScriptStep,
} from '../support/scripted-model.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const suggestion = {
  name: 'Navy wool blazer',
  category: 'outerwear',
  colour: 'navy',
  formality: 'formal',
  seasons: ['autumn', 'winter'],
};

describe('Photo tagging', () => {
  let t: TestApp;
  let model: ScriptedChatModel;
  const http = () => request(t.app.getHttpServer());

  async function start(script: ScriptStep[]) {
    model = new ScriptedChatModel(script);
    t = await createTestApp({}, new FakeProvider([], model));
  }
  afterEach(() => t.close());

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/v1/auth/register')
      .send({ email, password: 'a-long-password' })
      .expect(201);
    return res.body.accessToken;
  }

  /** Uploads a photo and confirms it, which queues tagging. */
  async function upload(token: string): Promise<string> {
    const res = await http()
      .post('/v1/photos')
      .set('Authorization', `Bearer ${token}`)
      .send({ contentType: 'image/jpeg', size: 3 })
      .expect(201);
    const id: string = res.body.photo.id;
    t.storage.put(
      `photos/${id}`,
      { size: 3, contentType: 'image/jpeg' },
      new Uint8Array([7, 8, 9]),
    );
    const done = await http()
      .post(`/v1/photos/${id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(done.body.tagStatus).toBe('pending');
    return id;
  }

  /** Tagging runs in the background; poll like a client would. */
  async function settled(token: string, id: string) {
    for (let i = 0; i < 100; i += 1) {
      const res = await http()
        .get(`/v1/photos/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      if (res.body.tagStatus !== 'pending') return res.body;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('tagging did not finish');
  }

  it('suggests tags after upload, and saves the corrected item beside the original suggestion', async () => {
    await start([[toolCallChunk('photo_tags', suggestion)]]);
    const token = await signUp('ana@example.com');
    const id = await upload(token);

    const photo = await settled(token, id);
    expect(photo).toMatchObject({
      tagStatus: 'tagged',
      suggestedTags: suggestion,
    });
    // The photo itself went to the vision model, read from storage by the server.
    expect(JSON.stringify(model.received[0])).toContain(
      'data:image/jpeg;base64,BwgJ',
    );

    // The user corrects the colour and name, then saves the item.
    const item = await http()
      .post('/v1/wardrobe/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...suggestion,
        name: 'Charcoal wool blazer',
        colour: 'charcoal',
        photoId: id,
      })
      .expect(201);
    expect(item.body).toMatchObject({
      name: 'Charcoal wool blazer',
      colour: 'charcoal',
      photoId: id,
    });
    const again = await settled(token, id);
    expect(again.suggestedTags.colour).toBe('navy');
  });

  it('marks the photo failed when the model twice gives no valid tags', async () => {
    await start([
      [toolCallChunk('photo_tags', { ...suggestion, category: 'cape' })],
      textChunks('I think it is a jacket.'),
    ]);
    const token = await signUp('ana@example.com');
    const id = await upload(token);

    const photo = await settled(token, id);
    expect(photo).toMatchObject({ tagStatus: 'failed', suggestedTags: null });
    expect(model.received).toHaveLength(2);
  });

  it("does not show one user another user's photo", async () => {
    await start([[toolCallChunk('photo_tags', suggestion)]]);
    const ana = await signUp('ana@example.com');
    const ben = await signUp('ben@example.com');
    const id = await upload(ana);
    await settled(ana, id);

    await http()
      .get(`/v1/photos/${id}`)
      .set('Authorization', `Bearer ${ben}`)
      .expect(404);
    await http().get(`/v1/photos/${id}`).expect(401);
    await http()
      .get('/v1/photos/not-a-uuid')
      .set('Authorization', `Bearer ${ana}`)
      .expect(400);
  });
});
