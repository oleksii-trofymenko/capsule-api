import { eq } from 'drizzle-orm';
import { photos, users, wardrobeItems } from '../../src/db/schema.js';
import { createTestDb } from '../support/test-db.js';

async function withUserAndPhoto() {
  const { db, close } = await createTestDb();
  const [user] = await db
    .insert(users)
    .values({ email: 'ana@example.com', passwordHash: 'not-a-real-hash' })
    .returning();
  const [photo] = await db
    .insert(photos)
    .values({
      userId: user.id,
      storageKey: 'photos/one',
      contentType: 'image/jpeg',
      sizeBytes: 100,
      status: 'uploaded',
    })
    .returning();
  await db.insert(wardrobeItems).values({
    userId: user.id,
    photoId: photo.id,
    name: 'Navy wool blazer',
    category: 'outerwear',
    colour: 'navy',
    formality: 'formal',
    seasons: ['autumn', 'winter'],
  });
  return { db, close, user, photo };
}

describe('wardrobe_items table', () => {
  it("removes a user's items when the user is deleted", async () => {
    const { db, close, user } = await withUserAndPhoto();
    await db.delete(users).where(eq(users.id, user.id));
    expect(await db.select().from(wardrobeItems)).toEqual([]);
    await close();
  });

  it('keeps the item but unlinks it when its photo is deleted', async () => {
    const { db, close, photo } = await withUserAndPhoto();
    await db.delete(photos).where(eq(photos.id, photo.id));
    const [item] = await db.select().from(wardrobeItems);
    expect(item).toMatchObject({ name: 'Navy wool blazer', photoId: null });
    await close();
  });
});
