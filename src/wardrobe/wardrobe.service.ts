import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { photos, wardrobeItems, type WardrobeItemRow } from '../db/schema.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../storage/object-storage.js';
import type {
  CreateItemInput,
  UpdateItemInput,
  WardrobeItem,
} from './wardrobe.schemas.js';

/** Long enough to browse the wardrobe; clients refetch the list before links expire. */
const PHOTO_URL_SECONDS = 15 * 60;

const toItem = (
  row: WardrobeItemRow,
  photoUrl: string | null,
): WardrobeItem => ({
  id: row.id,
  name: row.name,
  category: row.category,
  colour: row.colour,
  formality: row.formality,
  seasons: row.seasons,
  size:
    row.sizeSystem && row.sizeValue
      ? { system: row.sizeSystem, value: row.sizeValue }
      : null,
  photoId: row.photoId,
  photoUrl,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** The size object maps to two columns; null clears both. */
const sizeColumns = (size: CreateItemInput['size']) => ({
  sizeSystem: size?.system ?? null,
  sizeValue: size?.value ?? null,
});

@Injectable()
export class WardrobeService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async create(userId: string, input: CreateItemInput): Promise<WardrobeItem> {
    await this.assertOwnUploadedPhoto(userId, input.photoId);
    const { size, ...fields } = input;
    const [row] = await this.db
      .insert(wardrobeItems)
      .values({ ...fields, ...sizeColumns(size), userId })
      .returning();
    return (await this.present(userId, [row]))[0];
  }

  async list(userId: string): Promise<WardrobeItem[]> {
    const rows = await this.db
      .select()
      .from(wardrobeItems)
      .where(eq(wardrobeItems.userId, userId))
      .orderBy(desc(wardrobeItems.createdAt), desc(wardrobeItems.id));
    return this.present(userId, rows);
  }

  async get(userId: string, id: string): Promise<WardrobeItem> {
    const [row] = await this.db
      .select()
      .from(wardrobeItems)
      .where(this.owned(userId, id))
      .limit(1);
    if (!row) throw new NotFoundException('Item not found');
    return (await this.present(userId, [row]))[0];
  }

  async update(
    userId: string,
    id: string,
    input: UpdateItemInput,
  ): Promise<WardrobeItem> {
    if (input.photoId !== undefined) {
      await this.assertOwnUploadedPhoto(userId, input.photoId);
    }
    const { size, ...fields } = input;
    const [row] = await this.db
      .update(wardrobeItems)
      .set({
        ...fields,
        ...(size === undefined ? {} : sizeColumns(size)),
        updatedAt: new Date(),
      })
      .where(this.owned(userId, id))
      .returning();
    if (!row) throw new NotFoundException('Item not found');
    return (await this.present(userId, [row]))[0];
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(wardrobeItems)
      .where(this.owned(userId, id))
      .returning({ id: wardrobeItems.id });
    if (deleted.length === 0) throw new NotFoundException('Item not found');
  }

  /** Items as the API returns them, with a short-lived link to each one's photo. */
  private async present(
    userId: string,
    rows: WardrobeItemRow[],
  ): Promise<WardrobeItem[]> {
    const photoIds = rows.flatMap((r) => (r.photoId ? [r.photoId] : []));
    const keys = new Map<string, string>();
    if (photoIds.length > 0) {
      const found = await this.db
        .select({ id: photos.id, key: photos.storageKey })
        .from(photos)
        .where(and(eq(photos.userId, userId), inArray(photos.id, photoIds)));
      for (const p of found) keys.set(p.id, p.key);
    }
    return Promise.all(
      rows.map(async (row) => {
        const key = row.photoId ? keys.get(row.photoId) : undefined;
        const url = key
          ? await this.storage.presignDownload(key, PHOTO_URL_SECONDS)
          : null;
        return toItem(row, url);
      }),
    );
  }

  private owned(userId: string, id: string) {
    return and(eq(wardrobeItems.id, id), eq(wardrobeItems.userId, userId));
  }

  /** One message for missing, someone else's, or not yet uploaded: reveal nothing. */
  private async assertOwnUploadedPhoto(userId: string, photoId: string | null) {
    if (photoId === null) return;
    const [photo] = await this.db
      .select({ id: photos.id })
      .from(photos)
      .where(
        and(
          eq(photos.id, photoId),
          eq(photos.userId, userId),
          eq(photos.status, 'uploaded'),
        ),
      )
      .limit(1);
    if (!photo) throw new UnprocessableEntityException('Unknown photo');
  }
}
