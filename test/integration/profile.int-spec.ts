import { eq } from 'drizzle-orm';
import { styleProfiles, users } from '../../src/db/schema.js';
import { createTestDb } from '../support/test-db.js';

describe('style_profiles table', () => {
  it("removes a user's profile when the user is deleted", async () => {
    const { db, close } = await createTestDb();
    const [user] = await db
      .insert(users)
      .values({ email: 'ana@example.com', passwordHash: 'not-a-real-hash' })
      .returning();
    await db.insert(styleProfiles).values({
      userId: user.id,
      sizes: { top: null, bottom: null, shoes: { system: 'UK', value: '6' } },
      fit: 'regular',
      directions: ['classic'],
      favouriteColours: [],
      avoidColours: [],
      lifestyle: 'mixed',
      neverWear: [],
    });

    await db.delete(users).where(eq(users.id, user.id));

    expect(await db.select().from(styleProfiles)).toEqual([]);
    await close();
  });
});
