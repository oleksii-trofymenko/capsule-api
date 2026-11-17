import { eq } from 'drizzle-orm';
import { parseEnv } from '../../src/config/env.js';
import { photos, users } from '../../src/db/schema.js';
import { MetricsService } from '../../src/metrics/metrics.service.js';
import { ModelRouter } from '../../src/models/model-router.service.js';
import { TaggingService } from '../../src/tagging/tagging.service.js';
import { TEST_ENV } from '../support/env.js';
import { FakeObjectStorage } from '../support/fake-object-storage.js';
import { FakeProvider } from '../support/fake-provider.js';
import { ScriptedChatModel, toolCallChunk } from '../support/scripted-model.js';
import { createTestDb } from '../support/test-db.js';

describe('TaggingService', () => {
  it('resumes photos a restart left waiting, and only those', async () => {
    const { db, close } = await createTestDb();
    const storage = new FakeObjectStorage();
    const [user] = await db
      .insert(users)
      .values({ email: 'ana@example.com', passwordHash: 'not-a-real-hash' })
      .returning();
    const photo = (key: string, status: 'pending' | 'uploaded') => ({
      userId: user.id,
      storageKey: key,
      contentType: 'image/jpeg',
      sizeBytes: 3,
      status,
    });
    const [waiting] = await db
      .insert(photos)
      .values(photo('photos/waiting', 'uploaded'))
      .returning();
    await db.insert(photos).values(photo('photos/not-uploaded', 'pending'));
    storage.put('photos/waiting', { size: 3, contentType: 'image/jpeg' });

    const model = new ScriptedChatModel([
      [
        toolCallChunk('photo_tags', {
          name: 'Grey marl t-shirt',
          category: 'top',
          colour: 'grey',
          formality: 'casual',
          seasons: ['summer'],
        }),
      ],
    ]);
    const metrics = new MetricsService();
    const router = new ModelRouter(
      parseEnv(TEST_ENV),
      [new FakeProvider([], model)],
      metrics,
    );
    const tagging = new TaggingService(db, storage, router, metrics);

    await tagging.onApplicationBootstrap();
    await tagging.onApplicationShutdown();

    const rows = await db.select().from(photos);
    const tagged = rows.find((r) => r.id === waiting.id);
    expect(tagged).toMatchObject({
      tagStatus: 'tagged',
      tagModel: 'ollama:gemma4:12b',
      tags: { name: 'Grey marl t-shirt' },
    });
    const untouched = rows.find((r) => r.storageKey === 'photos/not-uploaded');
    expect(untouched?.tagStatus).toBe('pending');
    expect(model.received).toHaveLength(1);

    await db.delete(photos).where(eq(photos.userId, user.id));
    await close();
  });
});
