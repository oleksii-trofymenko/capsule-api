import { z } from 'zod';
import { photoTagsSchema } from '../tagging/tagging.schemas.js';

/** Formats phone cameras and browsers produce. HEIC is the iPhone default. */
export const PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

/** Well above a full-resolution phone photo (about 3 to 8 MB). */
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

export const createUploadSchema = z.object({
  contentType: z.enum(PHOTO_TYPES),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_PHOTO_BYTES)
    .describe(
      'Exact file size in bytes; the upload URL accepts only this size',
    ),
});

export const photoIdSchema = z.uuid();

export const photoSchema = z.object({
  id: z.uuid(),
  status: z.enum(['pending', 'uploaded']),
  contentType: z.string(),
  size: z.number().int(),
  createdAt: z.iso.datetime(),
  uploadedAt: z.iso.datetime().nullable(),
  tagStatus: z
    .enum(['pending', 'tagged', 'failed'])
    .describe(
      'Tagging starts after upload; poll until it is no longer pending',
    ),
  suggestedTags: photoTagsSchema
    .nullable()
    .describe('Pre-fill for the wardrobe item; the user corrects it there'),
});

export const photoUploadSchema = z.object({
  photo: photoSchema,
  upload: z
    .object({
      url: z.url(),
      method: z.literal('PUT'),
      headers: z.object({ 'Content-Type': z.string() }),
      expiresAt: z.iso.datetime(),
    })
    .describe('Send the file body straight to this URL, then call complete'),
});

export type CreateUploadInput = z.infer<typeof createUploadSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type PhotoUpload = z.infer<typeof photoUploadSchema>;
