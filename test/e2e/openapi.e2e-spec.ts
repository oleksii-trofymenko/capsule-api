import { buildOpenApi } from '../../src/app.setup.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

/** The spec is the contract the web and mobile clients are generated from. */
describe('OpenAPI contract', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('documents the versioned routes and hides the metrics endpoint', () => {
    const paths = Object.keys(buildOpenApi(t.app).paths).sort();
    expect(paths).toEqual([
      '/v1/auth/login',
      '/v1/auth/logout',
      '/v1/auth/me',
      '/v1/auth/refresh',
      '/v1/auth/register',
      '/v1/health',
      '/v1/health/ready',
      '/v1/models',
      '/v1/playground/chat',
    ]);
  });

  it('describes request and response bodies from the Zod schemas', () => {
    const doc = JSON.parse(JSON.stringify(buildOpenApi(t.app)));
    const resolve = (s: any) =>
      s?.$ref ? doc.components.schemas[s.$ref.split('/').pop()] : s;

    const register = doc.paths['/v1/auth/register'].post;
    const body = resolve(
      register.requestBody.content['application/json'].schema,
    );
    expect(body.required).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
    expect(body.properties.password).toMatchObject({
      minLength: 10,
      maxLength: 128,
    });

    const tokens = resolve(
      register.responses['201'].content['application/json'].schema,
    );
    expect(Object.keys(tokens.properties).sort()).toEqual([
      'accessToken',
      'expiresIn',
      'refreshToken',
      'tokenType',
    ]);
  });

  it('marks protected routes with bearer auth', () => {
    const doc = buildOpenApi(t.app);
    expect(doc.paths['/v1/auth/me'].get?.security).toEqual([{ bearer: [] }]);
    expect(doc.paths['/v1/auth/login'].post?.security).toBeUndefined();
  });
});
