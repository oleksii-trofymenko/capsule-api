import type {
  ObjectStorage,
  StoredObject,
} from '../../src/storage/object-storage.js';

/** In-memory storage. `put` stands in for a client uploading to a presigned URL. */
export class FakeObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, StoredObject>();
  readonly bodies = new Map<string, Uint8Array>();
  readonly presigned: {
    key: string;
    contentType: string;
    size: number;
    expiresInSeconds: number;
  }[] = [];

  async presignUpload(
    key: string,
    contentType: string,
    size: number,
    expiresInSeconds: number,
  ) {
    this.presigned.push({ key, contentType, size, expiresInSeconds });
    return `https://storage.test/${key}?X-Amz-Signature=fake`;
  }

  async get(key: string) {
    const body = this.bodies.get(key);
    if (!body) throw new Error(`No object ${key}`);
    return body;
  }

  async head(key: string) {
    return this.objects.get(key) ?? null;
  }

  async delete(key: string) {
    this.objects.delete(key);
    this.bodies.delete(key);
  }

  put(key: string, object: StoredObject, body = new Uint8Array(object.size)) {
    this.objects.set(key, object);
    this.bodies.set(key, body);
  }
}
