import { parseEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/capsule',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
};

describe('parseEnv', () => {
  it('applies defaults for local development', () => {
    const env = parseEnv(base);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGINS: [],
      MODEL_VISION: 'ollama:gemma4:12b',
      OLLAMA_BASE_URL: 'http://localhost:11434',
    });
  });

  it('parses comma-separated origins', () => {
    const env = parseEnv({
      ...base,
      CORS_ORIGINS: 'https://a.test, https://b.test,',
    });
    expect(env.CORS_ORIGINS).toEqual(['https://a.test', 'https://b.test']);
  });

  it('rejects a short JWT secret and names the variable without echoing its value', () => {
    expect(() =>
      parseEnv({ ...base, JWT_ACCESS_SECRET: 'short-secret' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
    try {
      parseEnv({ ...base, JWT_ACCESS_SECRET: 'short-secret' });
    } catch (e) {
      expect(String(e)).not.toContain('short-secret');
    }
  });

  it('rejects a model spec without a provider', () => {
    expect(() => parseEnv({ ...base, MODEL_VISION: 'gemma4' })).toThrow(
      /MODEL_VISION/,
    );
  });

  it('requires a metrics token and CORS origins in production', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /METRICS_TOKEN[\s\S]*CORS_ORIGINS/,
    );
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        METRICS_TOKEN: 'm'.repeat(24),
        CORS_ORIGINS: 'https://capsule.example',
      }),
    ).not.toThrow();
  });
});
