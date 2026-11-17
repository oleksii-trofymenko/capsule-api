import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { ENV } from '../../src/config/config.module.js';
import { parseEnv } from '../../src/config/env.js';
import { DB, PG_POOL } from '../../src/db/db.module.js';
import {
  MODEL_PROVIDERS,
  type ModelProvider,
} from '../../src/models/providers/model-provider.js';
import { TEST_ENV } from './env.js';
import { FakeProvider } from './fake-provider.js';
import { createTestDb } from './test-db.js';

export interface TestApp {
  app: INestApplication<App>;
  close: () => Promise<void>;
}

/** The full application, with only the database driver and the model vendor swapped. */
export async function createTestApp(
  envOverrides: Record<string, string> = {},
  provider: ModelProvider = new FakeProvider(),
): Promise<TestApp> {
  const { db, close: closeDb } = await createTestDb();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue(parseEnv({ ...TEST_ENV, ...envOverrides }))
    .overrideProvider(PG_POOL)
    .useValue({})
    .overrideProvider(DB)
    .useValue(db)
    .overrideProvider(MODEL_PROVIDERS)
    .useValue([provider])
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>({
    bodyParser: false,
  });
  configureApp(app);
  await app.init();
  return {
    app,
    close: async () => {
      await app.close();
      await closeDb();
    },
  };
}
