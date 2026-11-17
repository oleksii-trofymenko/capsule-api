import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DB, type Db } from '../db/db.module.js';
import { photos, type PhotoRow } from '../db/schema.js';
import { TaggingService } from '../tagging/tagging.service.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../storage/object-storage.js';
import type {
  CreateUploadInput,
  Photo,
  PhotoUpload,
} from './photos.schemas.js';

/** Long enough for a slow mobile upload, short enough that a leaked URL soon dies. */
const UPLOAD_URL_SECONDS = 5 * 60;

const toPhoto = (row: PhotoRow): Photo => ({
  id: row.id,
  status: row.status,
  contentType: row.contentType,
  size: row.sizeBytes,
  createdAt: row.createdAt.toISOString(),
  uploadedAt: row.uploadedAt?.toISOString() ?? null,
  tagStatus: row.tagStatus,
  suggestedTags: row.tags,
});

@Injectable()
export class PhotosService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(TaggingService) private readonly tagging: TaggingService,
  ) {}

  async createUpload(
    userId: string,
    input: CreateUploadInput,
  ): Promise<PhotoUpload> {
    const id = randomUUID();
    // No user id or file name in the key: nothing personal leaks into storage paths.
    const storageKey = `photos/${id}`;
    const [row] = await this.db
      .insert(photos)
      .values({
        id,
        userId,
        storageKey,
        contentType: input.contentType,
        sizeBytes: input.size,
      })
      .returning();
    const url = await this.storage.presignUpload(
      storageKey,
      input.contentType,
      input.size,
      UPLOAD_URL_SECONDS,
    );
    return {
      photo: toPhoto(row),
      upload: {
        url,
        method: 'PUT',
        headers: { 'Content-Type': input.contentType },
        expiresAt: new Date(
          Date.now() + UPLOAD_URL_SECONDS * 1000,
        ).toISOString(),
      },
    };
  }

  async get(userId: string, id: string): Promise<Photo> {
    return toPhoto(await this.find(userId, id));
  }

  /** Confirms the upload by reading the object's metadata, then queues tagging. Safe to call twice. */
  async complete(userId: string, id: string): Promise<Photo> {
    const row = await this.find(userId, id);
    if (row.status === 'uploaded') return toPhoto(row);

    const stored = await this.storage.head(row.storageKey);
    if (!stored) {
      throw new ConflictException('The photo has not been uploaded yet');
    }
    // The signed URL already pins size and type; this guards stores that do not enforce it.
    if (
      stored.size !== row.sizeBytes ||
      stored.contentType !== row.contentType
    ) {
      await this.storage.delete(row.storageKey);
      throw new UnprocessableEntityException(
        'The uploaded file does not match its declared size and type',
      );
    }

    const [updated] = await this.db
      .update(photos)
      .set({ status: 'uploaded', uploadedAt: new Date() })
      .where(and(eq(photos.id, id), eq(photos.userId, userId)))
      .returning();
    this.tagging.enqueue(id);
    return toPhoto(updated);
  }

  private async find(userId: string, id: string): Promise<PhotoRow> {
    const [row] = await this.db
      .select()
      .from(photos)
      .where(and(eq(photos.id, id), eq(photos.userId, userId)))
      .limit(1);
    if (!row) throw new NotFoundException('Photo not found');
    return row;
  }
}
