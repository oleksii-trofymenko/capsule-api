import request from 'supertest';
import { MAX_PHOTO_BYTES } from '../../src/photos/photos.schemas.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('Photos API', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const jpeg = { contentType: 'image/jpeg', size: 3_200_000 };

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/v1/auth/register')
      .send({ email, password: 'a-long-password' })
      .expect(201);
    return res.body.accessToken;
  }

  async function startUpload(token: string, body: object = jpeg) {
    const res = await http()
      .post('/v1/photos')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);
    return res.body;
  }

  const complete = (token: string, id: string) =>
    http()
      .post(`/v1/photos/${id}/complete`)
      .set('Authorization', `Bearer ${token}`);

  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(() => t.close());

  it('issues a presigned upload URL for the declared size and type, without taking the file', async () => {
    const token = await signUp('ana@example.com');
    const body = await startUpload(token);

    expect(body.photo).toEqual({
      id: expect.any(String),
      status: 'pending',
      contentType: 'image/jpeg',
      size: 3_200_000,
      createdAt: expect.any(String),
      uploadedAt: null,
    });
    expect(body.upload).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
    });
    expect(Date.parse(body.upload.expiresAt)).toBeGreaterThan(Date.now());
    expect(t.storage.presigned).toEqual([
      {
        key: `photos/${body.photo.id}`,
        contentType: 'image/jpeg',
        size: 3_200_000,
        expiresInSeconds: 300,
      },
    ]);
    expect(body.upload.url).toBe(
      `https://storage.test/photos/${body.photo.id}?X-Amz-Signature=fake`,
    );
  });

  it('confirms the photo only once the file is in storage, and is safe to repeat', async () => {
    const token = await signUp('ana@example.com');
    const { photo } = await startUpload(token);

    await complete(token, photo.id).expect(409);

    t.storage.put(`photos/${photo.id}`, {
      size: 3_200_000,
      contentType: 'image/jpeg',
    });
    const done = await complete(token, photo.id).expect(200);
    expect(done.body).toMatchObject({
      id: photo.id,
      status: 'uploaded',
      uploadedAt: expect.any(String),
    });

    const again = await complete(token, photo.id).expect(200);
    expect(again.body).toEqual(done.body);
  });

  it('rejects and removes a stored file that differs from what was declared', async () => {
    const token = await signUp('ana@example.com');
    const { photo } = await startUpload(token);
    const key = `photos/${photo.id}`;
    t.storage.put(key, { size: 999, contentType: 'image/jpeg' });

    await complete(token, photo.id).expect(422);
    expect(t.storage.objects.has(key)).toBe(false);
  });

  it("does not let one user confirm another user's photo", async () => {
    const ana = await signUp('ana@example.com');
    const ben = await signUp('ben@example.com');
    const { photo } = await startUpload(ana);
    t.storage.put(`photos/${photo.id}`, {
      size: 3_200_000,
      contentType: 'image/jpeg',
    });

    await complete(ben, photo.id).expect(404);
    await complete(ben, '00000000-0000-4000-8000-000000000000').expect(404);
    const own = await complete(ana, photo.id).expect(200);
    expect(own.body.status).toBe('uploaded');
  });

  it('requires a token', async () => {
    await http().post('/v1/photos').send(jpeg).expect(401);
    await http()
      .post('/v1/photos/00000000-0000-4000-8000-000000000000/complete')
      .expect(401);
  });

  it.each([
    ['a missing body', undefined],
    ['a type that is not a photo', { ...jpeg, contentType: 'application/pdf' }],
    ['an empty file', { ...jpeg, size: 0 }],
    ['a file over the limit', { ...jpeg, size: MAX_PHOTO_BYTES + 1 }],
    ['a fractional size', { ...jpeg, size: 10.5 }],
  ])('rejects %s with 400', async (_name, body) => {
    const token = await signUp('ana@example.com');
    await http()
      .post('/v1/photos')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(400);
    expect(t.storage.presigned).toEqual([]);
  });

  it('rejects a photo id that is not a uuid with 400', async () => {
    const token = await signUp('ana@example.com');
    await complete(token, 'not-a-uuid').expect(400);
  });
});
