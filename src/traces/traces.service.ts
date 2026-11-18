import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, notInArray } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { stylistTraces } from '../db/schema.js';
import type { TraceStore } from './trace-store.js';
import type { NewTrace, Trace } from './traces.schemas.js';

/** Traces kept per person; older answers can no longer be opened. */
export const MAX_TRACES = 20;

@Injectable()
export class TracesService implements TraceStore {
  constructor(@Inject(DB) private readonly db: Db) {}

  async save(userId: string, trace: NewTrace): Promise<string> {
    const [row] = await this.db
      .insert(stylistTraces)
      .values({ userId, body: trace })
      .returning({ id: stylistTraces.id });
    const kept = this.db
      .select({ id: stylistTraces.id })
      .from(stylistTraces)
      .where(eq(stylistTraces.userId, userId))
      .orderBy(desc(stylistTraces.createdAt), desc(stylistTraces.id))
      .limit(MAX_TRACES);
    await this.db
      .delete(stylistTraces)
      .where(
        and(
          eq(stylistTraces.userId, userId),
          notInArray(stylistTraces.id, kept),
        ),
      );
    return row.id;
  }

  async get(userId: string, id: string): Promise<Trace> {
    const [row] = await this.db
      .select()
      .from(stylistTraces)
      .where(and(eq(stylistTraces.id, id), eq(stylistTraces.userId, userId)));
    if (!row) throw new NotFoundException('Trace not found');
    return { id: row.id, createdAt: row.createdAt.toISOString(), ...row.body };
  }
}
