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
import { OBJECT_STORAGE } from '../../src/storage/object-storage.js';
import { TEST_ENV } from './env.js';
import { FakeObjectStorage } from './fake-object-storage.js';
import { FakeProvider } from './fake-provider.js';
import { createTestDb } from './test-db.js';

export interface TestApp {
  app: INestApplication<App>;
  storage: FakeObjectStorage;
  close: () => Promise<void>;
}

/** The full application, with only the database driver, the model vendor and the photo store swapped. */
export async function createTestApp(
  envOverrides: Record<string, string> = {},
  provider: ModelProvider = new FakeProvider(),
): Promise<TestApp> {
  const { db, close: closeDb } = await createTestDb();
  const storage = new FakeObjectStorage();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue(parseEnv({ ...TEST_ENV, ...envOverrides }))
    .overrideProvider(PG_POOL)
    .useValue({})
    .overrideProvider(DB)
    .useValue(db)
    .overrideProvider(MODEL_PROVIDERS)
    .useValue([provider])
    .overrideProvider(OBJECT_STORAGE)
    .useValue(storage)
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>({
    bodyParser: false,
  });
  configureApp(app);
  await app.init();
  return {
    app,
    storage,
    close: async () => {
      await app.close();
      await closeDb();
    },
  };
}
