export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface StoredObject {
  size: number;
  contentType: string | undefined;
}

/**
 * Where photos live. Clients upload straight to it with presigned URLs, so
 * the API only ever handles metadata, never a file body.
 */
export interface ObjectStorage {
  /** A URL that accepts one PUT of exactly this size and content type until it expires. */
  presignUpload(
    key: string,
    contentType: string,
    size: number,
    expiresInSeconds: number,
  ): Promise<string>;
  /** A URL that lets a client read the object until it expires. The URL is a credential: never log it. */
  presignDownload(key: string, expiresInSeconds: number): Promise<string>;
  /** The whole object. Only for server-side processing, such as tagging; never for serving clients. */
  get(key: string): Promise<Uint8Array>;
  /** The object's metadata, or null if it does not exist. Does not read the body. */
  head(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}
