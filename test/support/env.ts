// Runs before every test file. Values here win over a developer's local .env.
export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://test:test@localhost:5432/test',
  JWT_ACCESS_SECRET: 'test-only-secret-test-only-secret-0123456789',
  CORS_ORIGINS: 'https://app.capsule.test',
  RATE_LIMIT_PER_MINUTE: '1000',
  AUTH_RATE_LIMIT_PER_MINUTE: '1000',
  OLLAMA_BASE_URL: 'http://127.0.0.1:1',
} as const;

Object.assign(process.env, TEST_ENV);
delete process.env.METRICS_TOKEN;
