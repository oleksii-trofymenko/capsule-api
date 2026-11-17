import { eq } from 'drizzle-orm';
import { photos, users } from '../../src/db/schema.js';
import { createTestDb } from '../support/test-db.js';

describe('photos table', () => {
  it("removes a user's photo records when the user is deleted", async () => {
    const { db, close } = await createTestDb();
    const [user] = await db
      .insert(users)
      .values({ email: 'ana@example.com', passwordHash: 'not-a-real-hash' })
      .returning();
    await db.insert(photos).values({
      userId: user.id,
      storageKey: 'photos/one',
      contentType: 'image/jpeg',
      sizeBytes: 100,
    });

    await db.delete(users).where(eq(users.id, user.id));

    expect(await db.select().from(photos)).toEqual([]);
    await close();
  });

  it('refuses two records for the same storage key', async () => {
    const { db, close } = await createTestDb();
    const [user] = await db
      .insert(users)
      .values({ email: 'ana@example.com', passwordHash: 'not-a-real-hash' })
      .returning();
    const row = {
      userId: user.id,
      storageKey: 'photos/same',
      contentType: 'image/jpeg',
      sizeBytes: 100,
    };
    await db.insert(photos).values(row);

    await expect(db.insert(photos).values(row)).rejects.toThrow();
    await close();
  });
});
