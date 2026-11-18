import { eq } from 'drizzle-orm';
import { stylistTraces, users } from '../../src/db/schema.js';
import { MAX_TRACES, TracesService } from '../../src/traces/traces.service.js';
import type { NewTrace } from '../../src/traces/traces.schemas.js';
import { createTestDb } from '../support/test-db.js';

const trace = (question: string): NewTrace => ({
  steps: ['load-context', 'understand', 'answer'],
  occasion: null,
  candidates: [],
  outfit: [],
  calls: [
    {
      step: 'answer',
      messages: [{ role: 'human', text: question }],
      output: 'An answer.',
      failed: false,
    },
  ],
  failed: false,
});

async function setup() {
  const { db, close } = await createTestDb();
  const [user] = await db
    .insert(users)
    .values({ email: 'ana@example.com', passwordHash: 'not-a-real-hash' })
    .returning();
  return { db, close, traces: new TracesService(db), userId: user.id };
}

describe('TracesService', () => {
  it(`keeps the newest ${MAX_TRACES} traces, dropping the oldest`, async () => {
    const { close, traces, userId } = await setup();
    const ids: string[] = [];
    for (let i = 1; i <= MAX_TRACES + 2; i += 1) {
      ids.push(await traces.save(userId, trace(`question ${i}`)));
    }

    await expect(traces.get(userId, ids[0])).rejects.toThrow('not found');
    await expect(traces.get(userId, ids[1])).rejects.toThrow('not found');
    const newest = await traces.get(userId, ids.at(-1) ?? '');
    expect(newest.calls[0].messages[0].text).toBe(`question ${MAX_TRACES + 2}`);
    await close();
  });

  it("removes a user's traces when the user is deleted", async () => {
    const { db, close, traces, userId } = await setup();
    await traces.save(userId, trace('Which shoes do I own?'));

    await db.delete(users).where(eq(users.id, userId));

    expect(await db.select().from(stylistTraces)).toEqual([]);
    await close();
  });
});
