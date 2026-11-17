import { parseEnv } from '../config/env.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { S3ObjectStorage } from './s3-object-storage.js';

// Signing a URL is local computation: no storage server is contacted.
const storage = new S3ObjectStorage(
  parseEnv({
    DATABASE_URL: 'postgres://u:p@localhost:5432/capsule',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    S3_ENDPOINT: 'http://storage.test:8333',
    S3_BUCKET: 'photos-bucket',
    S3_ACCESS_KEY_ID: 'test-access-key',
    S3_SECRET_ACCESS_KEY: 'test-secret-key',
  }),
  new MetricsService(),
);

describe('S3ObjectStorage.presignUpload', () => {
  it('signs the size and type so the store refuses any other file', async () => {
    const url = new URL(
      await storage.presignUpload('photos/abc', 'image/jpeg', 1234, 300),
    );
    expect(url.origin + url.pathname).toBe(
      'http://storage.test:8333/photos-bucket/photos/abc',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
      'content-length;content-type;host',
    );
  });

  it('adds no checksum, which would be computed for an empty body and fail every upload', async () => {
    const url = new URL(
      await storage.presignUpload('photos/abc', 'image/jpeg', 1234, 300),
    );
    const names = [...url.searchParams.keys()].map((k) => k.toLowerCase());
    expect(names.filter((k) => k.includes('checksum'))).toEqual([]);
  });
});

describe('S3ObjectStorage.presignDownload', () => {
  it('signs a read of one object for a limited time, with no checksum to fail it', async () => {
    const url = new URL(await storage.presignDownload('photos/abc', 900));
    expect(url.origin + url.pathname).toBe(
      'http://storage.test:8333/photos-bucket/photos/abc',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    const names = [...url.searchParams.keys()].map((k) => k.toLowerCase());
    expect(names.filter((k) => k.includes('checksum'))).toEqual([]);
  });
});
