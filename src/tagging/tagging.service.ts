import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { photos, type PhotoTags } from '../db/schema.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { ModelRouter } from '../models/model-router.service.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../storage/object-storage.js';
import { taggingPrompts, type Locale } from './tagging.prompts.js';
import { normaliseTags, photoTagsSchema } from './tagging.schemas.js';

/** English only for now; the user's locale is not modelled yet. */
const LOCALE: Locale = 'en';

export function buildTaggingMessages(
  locale: Locale,
  contentType: string,
  body: Uint8Array,
) {
  const dataUrl = `data:${contentType};base64,${Buffer.from(body).toString('base64')}`;
  return [
    new SystemMessage(taggingPrompts[locale]),
    new HumanMessage({
      content: [
        { type: 'text', text: 'Catalogue this item.' },
        { type: 'image_url', image_url: dataUrl },
      ],
    }),
  ];
}

/**
 * Tags uploaded photos with the vision model, one at a time: a local GPU
 * serves one request well, and a cold model load can take a minute, which
 * is too long to hold an HTTP request open.
 */
@Injectable()
export class TaggingService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TaggingService.name);
  private queue: Promise<void> = Promise.resolve();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(ModelRouter) private readonly models: ModelRouter,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  /** The queue lives in memory, so pick up photos a restart left waiting. */
  async onApplicationBootstrap() {
    try {
      const waiting = await this.db
        .select({ id: photos.id })
        .from(photos)
        .where(
          and(eq(photos.status, 'uploaded'), eq(photos.tagStatus, 'pending')),
        );
      for (const { id } of waiting) this.enqueue(id);
    } catch {
      // No database, for example while generating openapi.json.
      this.logger.warn('Could not resume photo tagging: database unavailable');
    }
  }

  onApplicationShutdown() {
    return this.queue;
  }

  enqueue(photoId: string) {
    this.queue = this.queue.then(() => this.tag(photoId));
  }

  private async tag(photoId: string) {
    const stop = this.metrics.photoTaggingDuration.startTimer();
    let outcome: 'tagged' | 'failed' | 'skipped' = 'failed';
    const route = this.models.describe().vision;
    try {
      const [photo] = await this.db
        .select()
        .from(photos)
        .where(eq(photos.id, photoId))
        .limit(1);
      if (!photo || photo.tagStatus !== 'pending') {
        outcome = 'skipped';
        return;
      }
      const body = await this.storage.get(photo.storageKey);
      const tags = await this.describe(photo.contentType, body);
      outcome = tags ? 'tagged' : 'failed';
      await this.db
        .update(photos)
        .set({
          tagStatus: outcome,
          tags,
          tagModel: `${route.provider}:${route.model}`,
          taggedAt: new Date(),
        })
        .where(eq(photos.id, photoId));
    } catch (error) {
      // Never log the photo or the model's raw output: only what went wrong.
      this.logger.error(
        `Tagging photo ${photoId} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      await this.db
        .update(photos)
        .set({ tagStatus: 'failed', taggedAt: new Date() })
        .where(eq(photos.id, photoId))
        .catch(() => undefined);
    } finally {
      stop({ outcome });
      this.metrics.photoTagging.inc({ outcome });
    }
  }

  /** Two attempts, because small models sometimes return invalid output; then give up. */
  private async describe(
    contentType: string,
    body: Uint8Array,
  ): Promise<PhotoTags | null> {
    const model = this.models
      .chat('vision')
      .withStructuredOutput(photoTagsSchema, { name: 'photo_tags' });
    const messages = buildTaggingMessages(LOCALE, contentType, body);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const parsed = photoTagsSchema.safeParse(await model.invoke(messages));
        if (parsed.success) return normaliseTags(parsed.data);
      } catch {
        // Invalid output: try once more.
      }
    }
    return null;
  }
}
