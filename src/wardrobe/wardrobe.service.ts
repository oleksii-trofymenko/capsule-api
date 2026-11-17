import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { photos, wardrobeItems, type WardrobeItemRow } from '../db/schema.js';
import type {
  CreateItemInput,
  UpdateItemInput,
  WardrobeItem,
} from './wardrobe.schemas.js';

const toItem = (row: WardrobeItemRow): WardrobeItem => ({
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
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(userId: string, input: CreateItemInput): Promise<WardrobeItem> {
    await this.assertOwnUploadedPhoto(userId, input.photoId);
    const { size, ...fields } = input;
    const [row] = await this.db
      .insert(wardrobeItems)
      .values({ ...fields, ...sizeColumns(size), userId })
      .returning();
    return toItem(row);
  }

  async list(userId: string): Promise<WardrobeItem[]> {
    const rows = await this.db
      .select()
      .from(wardrobeItems)
      .where(eq(wardrobeItems.userId, userId))
      .orderBy(desc(wardrobeItems.createdAt), desc(wardrobeItems.id));
    return rows.map(toItem);
  }

  async get(userId: string, id: string): Promise<WardrobeItem> {
    const [row] = await this.db
      .select()
      .from(wardrobeItems)
      .where(this.owned(userId, id))
      .limit(1);
    if (!row) throw new NotFoundException('Item not found');
    return toItem(row);
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
    return toItem(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(wardrobeItems)
      .where(this.owned(userId, id))
      .returning({ id: wardrobeItems.id });
    if (deleted.length === 0) throw new NotFoundException('Item not found');
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
