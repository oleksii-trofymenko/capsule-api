import { eq } from 'drizzle-orm';
import { personalNotes, users } from '../../src/db/schema.js';
import { MAX_NOTES, MemoryService } from '../../src/memory/memory.service.js';
import { createTestDb } from '../support/test-db.js';

async function setup() {
  const { db, close } = await createTestDb();
  const [user] = await db
    .insert(users)
    .values({ email: 'ana@example.com', passwordHash: 'not-a-real-hash' })
    .returning();
  return { db, close, memory: new MemoryService(db), userId: user.id };
}

describe('MemoryService', () => {
  it(`keeps the newest ${MAX_NOTES} notes, dropping the oldest`, async () => {
    const { close, memory, userId } = await setup();
    for (let i = 1; i <= MAX_NOTES + 2; i += 1) {
      await memory.add(userId, [{ kind: 'like', text: `colour ${i}` }]);
    }

    const notes = await memory.list(userId);
    expect(notes).toHaveLength(MAX_NOTES);
    expect(notes[0].text).toBe(`colour ${MAX_NOTES + 2}`);
    expect(notes.map((n) => n.text)).not.toContain('colour 1');
    expect(notes.map((n) => n.text)).not.toContain('colour 2');
    await close();
  });

  it('keeps one note for the same words in any letter case, even within one message', async () => {
    const { close, memory, userId } = await setup();
    await memory.add(userId, [
      { kind: 'dislike', text: 'Navy' },
      { kind: 'dislike', text: 'navy' },
    ]);
    await memory.add(userId, [{ kind: 'dislike', text: 'NAVY' }]);

    expect(await memory.list(userId)).toHaveLength(1);
    await close();
  });

  it("removes a user's notes when the user is deleted", async () => {
    const { db, close, memory, userId } = await setup();
    await memory.add(userId, [{ kind: 'fact', text: 'wears UK 12' }]);

    await db.delete(users).where(eq(users.id, userId));

    expect(await db.select().from(personalNotes)).toEqual([]);
    await close();
  });
});
