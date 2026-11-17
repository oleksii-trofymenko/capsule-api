import request from 'supertest';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('Profile API', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const answers = {
    sizes: {
      top: { system: 'INT', value: 'M' },
      bottom: { system: 'UK', value: '12' },
      shoes: { system: 'EU', value: '39' },
    },
    fit: 'relaxed',
    directions: ['classic', 'minimal'],
    favouriteColours: ['neutrals', 'blues'],
    avoidColours: ['brights'],
    lifestyle: 'smart-casual-work',
    neverWear: ['high-necklines'],
  };

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/v1/auth/register')
      .send({ email, password: 'a-long-password' })
      .expect(201);
    return res.body.accessToken;
  }
  const as = (token: string) => ({
    get: (path: string) =>
      http().get(path).set('Authorization', `Bearer ${token}`),
    put: (path: string) =>
      http().put(path).set('Authorization', `Bearer ${token}`),
  });

  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(() => t.close());

  it('serves the quiz with questions, options and limits', async () => {
    const ana = as(await signUp('ana@example.com'));
    const quiz = await ana.get('/v1/profile/quiz').expect(200);
    expect(quiz.body.questions.map((q: { id: string }) => q.id)).toEqual([
      'sizes',
      'fit',
      'directions',
      'favouriteColours',
      'avoidColours',
      'lifestyle',
      'neverWear',
    ]);
    expect(quiz.body.questions[2]).toMatchObject({ type: 'multi', max: 3 });
    expect(quiz.body.questions[0].systems).toContainEqual({
      id: 'UK',
      label: 'UK',
    });
  });

  it('fills the profile from the answers, with every size carrying its system', async () => {
    const ana = as(await signUp('ana@example.com'));
    expect((await ana.get('/v1/profile').expect(200)).body).toEqual({
      profile: null,
    });

    const saved = await ana.put('/v1/profile').send(answers).expect(200);
    expect(saved.body).toEqual({
      profile: { ...answers, updatedAt: expect.any(String) },
    });
    expect((await ana.get('/v1/profile').expect(200)).body).toEqual(saved.body);
  });

  it('replaces the profile when the quiz is answered again, and allows skipped sizes', async () => {
    const ana = as(await signUp('ana@example.com'));
    await ana.put('/v1/profile').send(answers).expect(200);

    const again = await ana
      .put('/v1/profile')
      .send({
        ...answers,
        sizes: { top: null, bottom: null, shoes: { system: 'US', value: '8' } },
        fit: 'fitted',
        avoidColours: [],
        neverWear: [],
      })
      .expect(200);
    expect(again.body.profile).toMatchObject({
      sizes: { top: null, bottom: null, shoes: { system: 'US', value: '8' } },
      fit: 'fitted',
      avoidColours: [],
      neverWear: [],
    });
  });

  it("keeps each user's profile private", async () => {
    const ana = as(await signUp('ana@example.com'));
    const ben = as(await signUp('ben@example.com'));
    await ana.put('/v1/profile').send(answers).expect(200);

    expect((await ben.get('/v1/profile').expect(200)).body).toEqual({
      profile: null,
    });
    await ben
      .put('/v1/profile')
      .send({ ...answers, fit: 'fitted' })
      .expect(200);
    expect((await ana.get('/v1/profile').expect(200)).body.profile.fit).toBe(
      'relaxed',
    );
  });

  it('requires a token', async () => {
    await http().get('/v1/profile/quiz').expect(401);
    await http().get('/v1/profile').expect(401);
    await http().put('/v1/profile').send(answers).expect(401);
  });

  it.each([
    ['a missing body', undefined],
    [
      'a size without its system',
      { ...answers, sizes: { ...answers.sizes, top: { value: 'M' } } },
    ],
    [
      'letter sizing for shoes',
      {
        ...answers,
        sizes: { ...answers.sizes, shoes: { system: 'INT', value: 'M' } },
      },
    ],
    ['no style direction', { ...answers, directions: [] }],
    [
      'four style directions',
      { ...answers, directions: ['classic', 'minimal', 'edgy', 'sporty'] },
    ],
    ['an unknown direction', { ...answers, directions: ['goth'] }],
    ['a repeated choice', { ...answers, neverWear: ['heels', 'heels'] }],
    [
      'a colour both loved and avoided',
      { ...answers, avoidColours: ['blues'] },
    ],
    ['an unknown lifestyle', { ...answers, lifestyle: 'astronaut' }],
  ])('rejects %s with 400', async (_name, body) => {
    const ana = as(await signUp('ana@example.com'));
    await ana.put('/v1/profile').send(body).expect(400);
    expect((await ana.get('/v1/profile').expect(200)).body.profile).toBeNull();
  });
});
