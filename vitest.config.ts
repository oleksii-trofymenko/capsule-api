import { defineConfig } from 'vitest/config';

const shared = {
  globals: true,
  root: './',
  setupFiles: ['./test/support/env.ts'],
};

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/openapi.ts', 'src/**/*.spec.ts'],
    },
    projects: [
      {
        extends: true,
        // Pure logic, no I/O.
        test: { ...shared, name: 'unit', include: ['src/**/*.spec.ts'] },
      },
      {
        extends: true,
        // Services against a real Postgres engine (in-process PGlite).
        test: {
          ...shared,
          name: 'integration',
          include: ['test/integration/**/*.int-spec.ts'],
          // Each test builds a fresh database and applies every migration: about 5 s on a CI runner.
          testTimeout: 20_000,
        },
      },
      {
        extends: true,
        // The whole HTTP application, configured exactly like production.
        test: {
          ...shared,
          name: 'e2e',
          include: ['test/e2e/**/*.e2e-spec.ts'],
          testTimeout: 20_000,
        },
      },
    ],
  },
});
