import request from 'supertest';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('Wardrobe API', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const blazer = {
    name: 'Navy wool blazer',
    category: 'outerwear',
    colour: 'navy',
    formality: 'formal',
    seasons: ['autumn', 'winter'],
  };
  const missingId = '00000000-0000-4000-8000-000000000000';

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/v1/auth/register')
      .send({ email, password: 'a-long-password' })
      .expect(201);
    return res.body.accessToken;
  }

  const as = (token: string) => ({
    post: (path: string) =>
      http().post(path).set('Authorization', `Bearer ${token}`),
    get: (path: string) =>
      http().get(path).set('Authorization', `Bearer ${token}`),
    patch: (path: string) =>
      http().patch(path).set('Authorization', `Bearer ${token}`),
    delete: (path: string) =>
      http().delete(path).set('Authorization', `Bearer ${token}`),
  });

  /** A photo of this user's that has finished uploading. */
  async function uploadedPhoto(token: string): Promise<string> {
    const start = await as(token)
      .post('/v1/photos')
      .send({ contentType: 'image/jpeg', size: 1000 })
      .expect(201);
    const id: string = start.body.photo.id;
    t.storage.put(`photos/${id}`, { size: 1000, contentType: 'image/jpeg' });
    await as(token).post(`/v1/photos/${id}/complete`).expect(200);
    return id;
  }

  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(() => t.close());

  it('creates, lists, reads, edits and deletes an item', async () => {
    const ana = as(await signUp('ana@example.com'));

    const created = await ana
      .post('/v1/wardrobe/items')
      .send({ ...blazer, size: { system: 'UK', value: '40R' } })
      .expect(201);
    expect(created.body).toEqual({
      id: expect.any(String),
      ...blazer,
      size: { system: 'UK', value: '40R' },
      photoId: null,
      photoUrl: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const id: string = created.body.id;
    const path = `/v1/wardrobe/items/${id}`;

    const list = await ana.get('/v1/wardrobe/items').expect(200);
    expect(list.body).toEqual({ items: [created.body] });
    expect((await ana.get(path).expect(200)).body).toEqual(created.body);

    const edited = await ana
      .patch(path)
      .send({ colour: 'midnight navy', size: null })
      .expect(200);
    expect(edited.body).toMatchObject({
      name: 'Navy wool blazer',
      colour: 'midnight navy',
      size: null,
    });
    expect(Date.parse(edited.body.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(created.body.updatedAt),
    );

    await ana.delete(path).expect(204);
    await ana.get(path).expect(404);
    expect((await ana.get('/v1/wardrobe/items').expect(200)).body).toEqual({
      items: [],
    });
  });

  it("keeps each user's wardrobe private", async () => {
    const ana = as(await signUp('ana@example.com'));
    const ben = as(await signUp('ben@example.com'));
    const item = await ana.post('/v1/wardrobe/items').send(blazer).expect(201);
    const path = `/v1/wardrobe/items/${item.body.id}`;

    expect((await ben.get('/v1/wardrobe/items').expect(200)).body).toEqual({
      items: [],
    });
    await ben.get(path).expect(404);
    await ben.patch(path).send({ name: 'Mine now' }).expect(404);
    await ben.delete(path).expect(404);

    const still = await ana.get(path).expect(200);
    expect(still.body.name).toBe('Navy wool blazer');
  });

  it('returns 404 for an item that does not exist', async () => {
    const ana = as(await signUp('ana@example.com'));
    const path = `/v1/wardrobe/items/${missingId}`;
    await ana.get(path).expect(404);
    await ana.patch(path).send({ name: 'x' }).expect(404);
    await ana.delete(path).expect(404);
  });

  it('links only an uploaded photo of your own', async () => {
    const anaToken = await signUp('ana@example.com');
    const ana = as(anaToken);
    const benToken = await signUp('ben@example.com');
    const ben = as(benToken);
    const own = await uploadedPhoto(anaToken);
    const pending = await ana
      .post('/v1/photos')
      .send({ contentType: 'image/jpeg', size: 1000 })
      .expect(201);
    const bens = await uploadedPhoto(benToken);

    const linked = await ana
      .post('/v1/wardrobe/items')
      .send({ ...blazer, photoId: own })
      .expect(201);
    expect(linked.body.photoId).toBe(own);
    // A short-lived link to the photo comes with the item, on create and on list.
    const photoUrl = `https://storage.test/photos/${own}?X-Amz-Expires=900&download`;
    expect(linked.body.photoUrl).toBe(photoUrl);
    expect(
      (await ana.get('/v1/wardrobe/items').expect(200)).body.items,
    ).toEqual([expect.objectContaining({ id: linked.body.id, photoUrl })]);

    for (const photoId of [pending.body.photo.id, bens, missingId]) {
      await ana
        .post('/v1/wardrobe/items')
        .send({ ...blazer, photoId })
        .expect(422);
      await ana
        .patch(`/v1/wardrobe/items/${linked.body.id}`)
        .send({ photoId })
        .expect(422);
    }
    expect(
      (await ben.get('/v1/wardrobe/items').expect(200)).body.items,
    ).toEqual([]);

    const unlinked = await ana
      .patch(`/v1/wardrobe/items/${linked.body.id}`)
      .send({ photoId: null })
      .expect(200);
    expect(unlinked.body.photoId).toBeNull();
    expect(unlinked.body.photoUrl).toBeNull();
  });

  it('requires a token', async () => {
    await http().get('/v1/wardrobe/items').expect(401);
    await http().post('/v1/wardrobe/items').send(blazer).expect(401);
    await http().get(`/v1/wardrobe/items/${missingId}`).expect(401);
    await http().patch(`/v1/wardrobe/items/${missingId}`).expect(401);
    await http().delete(`/v1/wardrobe/items/${missingId}`).expect(401);
  });

  it.each([
    ['a missing body', undefined],
    ['an empty name', { ...blazer, name: '  ' }],
    ['an unknown category', { ...blazer, category: 'cape' }],
    ['no seasons', { ...blazer, seasons: [] }],
    ['a repeated season', { ...blazer, seasons: ['winter', 'winter'] }],
    ['a size without its system', { ...blazer, size: { value: '12' } }],
    ['a photo id that is not a uuid', { ...blazer, photoId: 'photo-1' }],
  ])('rejects creating with %s', async (_name, body) => {
    const ana = as(await signUp('ana@example.com'));
    await ana.post('/v1/wardrobe/items').send(body).expect(400);
  });

  it('rejects an empty edit and a bad id', async () => {
    const ana = as(await signUp('ana@example.com'));
    const item = await ana.post('/v1/wardrobe/items').send(blazer).expect(201);
    await ana.patch(`/v1/wardrobe/items/${item.body.id}`).send({}).expect(400);
    await ana.get('/v1/wardrobe/items/not-a-uuid').expect(400);
  });
});
