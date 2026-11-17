import { eq } from 'drizzle-orm';
import { outfits, users } from '../../src/db/schema.js';
import { createTestDb } from '../support/test-db.js';

describe('outfits table', () => {
  it("removes a user's outfits and their feedback when the user is deleted", async () => {
    const { db, close } = await createTestDb();
    const [user] = await db
      .insert(users)
      .values({ email: 'ana@example.com', passwordHash: 'not-a-real-hash' })
      .returning();
    await db.insert(outfits).values({
      userId: user.id,
      occasionId: 'office',
      items: [{ itemId: 'item-1', name: 'Navy wool blazer' }],
      rating: 'like',
      note: 'Comfortable',
      feedbackAt: new Date(),
    });

    await db.delete(users).where(eq(users.id, user.id));

    expect(await db.select().from(outfits)).toEqual([]);
    await close();
  });
});
