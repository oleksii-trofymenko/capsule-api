import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import * as schema from './schema.js';

/** Driver-agnostic type, so tests can swap node-postgres for in-process PGlite. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV],
      // The pool connects lazily, so the app can boot (and emit OpenAPI) without a database.
      useFactory: (env: Env) =>
        new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 }),
    },
    {
      provide: DB,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool): Db => drizzle(pool, { schema }),
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(
    @Inject(PG_POOL) private readonly pool: { end?: () => Promise<void> },
  ) {}

  async onApplicationShutdown() {
    await this.pool.end?.();
  }
}
