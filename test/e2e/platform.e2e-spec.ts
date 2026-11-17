import request from 'supertest';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('Platform behaviour', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  afterEach(() => t?.close());

  async function accessToken() {
    const res = await http()
      .post('/v1/auth/register')
      .send({ email: 'ana@example.com', password: 'a-long-password' })
      .expect(201);
    return res.body.accessToken as string;
  }

  describe('health', () => {
    it('reports liveness and database readiness without authentication', async () => {
      t = await createTestApp();
      expect((await http().get('/v1/health').expect(200)).body).toEqual({
        status: 'ok',
      });
      expect((await http().get('/v1/health/ready').expect(200)).body).toEqual({
        status: 'ok',
        database: 'up',
      });
    });
  });

  describe('security', () => {
    it('sets hardening headers and hides the framework', async () => {
      t = await createTestApp();
      const res = await http().get('/v1/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('allows CORS only for configured origins', async () => {
      t = await createTestApp();
      const allowed = await http()
        .get('/v1/health')
        .set('Origin', 'https://app.capsule.test');
      expect(allowed.headers['access-control-allow-origin']).toBe(
        'https://app.capsule.test',
      );
      const other = await http()
        .get('/v1/health')
        .set('Origin', 'https://evil.test');
      expect(other.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('requires authentication on routes by default', async () => {
      t = await createTestApp();
      await http().get('/v1/models').expect(401);
    });

    it('rejects oversized JSON bodies', async () => {
      t = await createTestApp();
      await http()
        .post('/v1/auth/login')
        .send({ email: 'ana@example.com', password: 'x'.repeat(200_000) })
        .expect(413);
    });

    it('does not leak internals on unknown routes', async () => {
      t = await createTestApp();
      const res = await http().get('/v1/nope').expect(404);
      expect(JSON.stringify(res.body)).not.toMatch(/node_modules|at \w+ \(/);
    });

    it('rate limits credential endpoints separately from the rest of the API', async () => {
      t = await createTestApp({ AUTH_RATE_LIMIT_PER_MINUTE: '3' });
      const attempt = () =>
        http()
          .post('/v1/auth/login')
          .send({ email: 'ana@example.com', password: 'wrong-password' });
      for (let i = 0; i < 3; i++) await attempt().expect(401);
      const limited = await attempt().expect(429);
      expect(limited.headers['retry-after']).toBeDefined();
      // Other endpoints are still served.
      await http().get('/v1/auth/me').expect(401);
    });
  });

  describe('models', () => {
    it('shows the routing table and provider health to signed-in users', async () => {
      t = await createTestApp();
      const res = await http()
        .get('/v1/models')
        .set('Authorization', `Bearer ${await accessToken()}`)
        .expect(200);
      expect(res.body).toEqual({
        routes: {
          vision: { provider: 'ollama', model: 'gemma4:12b' },
          reasoning: { provider: 'ollama', model: 'gemma4:12b' },
          embedding: { provider: 'ollama', model: 'nomic-embed-text' },
        },
        providers: { ollama: { ok: true, detail: 'fake' } },
      });
    });
  });

  describe('metrics', () => {
    it('exposes request counts labelled by route pattern and status', async () => {
      t = await createTestApp();
      await http().get('/v1/health').expect(200);
      await http().get('/v1/auth/me').expect(401);
      await http()
        .get('/v1/random/' + Date.now())
        .expect(404);

      const res = await http().get('/metrics').expect(200);
      expect(res.headers['content-type']).toMatch(/^text\/plain/);
      expect(res.text).toContain(
        'http_requests_total{method="GET",route="/v1/health",status="200"} 1',
      );
      expect(res.text).toContain(
        'http_requests_total{method="GET",route="/v1/auth/me",status="401"} 1',
      );
      // Unknown paths collapse into one label instead of one series per URL.
      expect(res.text).toContain(
        'http_requests_total{method="GET",route="unmatched",status="404"} 1',
      );
      expect(res.text).toContain('http_request_duration_seconds_bucket');
      expect(res.text).toContain('process_cpu_user_seconds_total');
    });

    it('requires the bearer token when METRICS_TOKEN is set', async () => {
      t = await createTestApp({ METRICS_TOKEN: 'metrics-token-0123456789' });
      await http().get('/metrics').expect(401);
      await http()
        .get('/metrics')
        .set('Authorization', 'Bearer wrong-token-0123456789')
        .expect(401);
      await http()
        .get('/metrics')
        .set('Authorization', 'Bearer metrics-token-0123456789')
        .expect(200);
    });
  });
});
