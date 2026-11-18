import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Db } from '../../src/db/db.module.js';
import * as schema from '../../src/db/schema.js';

/**
 * A real Postgres engine running in-process, with the project's actual
 * migrations applied. No Docker needed, and every call is an isolated database.
 */
export async function createTestDb(): Promise<{
  db: Db;
  close: () => Promise<void>;
}> {
  // pgvector, as in the Postgres image: knowledge passages store embeddings.
  const client = new PGlite({ extensions: { vector } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  return { db: db as unknown as Db, close: () => client.close() };
}
