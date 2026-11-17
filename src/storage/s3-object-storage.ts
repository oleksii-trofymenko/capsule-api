import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../config/env.js';
import type { MetricsService } from '../metrics/metrics.service.js';
import type { ObjectStorage, StoredObject } from './object-storage.js';

/** Any S3-compatible store: SeaweedFS locally, a cloud bucket later. */
export class S3ObjectStorage implements ObjectStorage {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    env: Env,
    private readonly metrics: MetricsService,
  ) {
    this.bucket = env.S3_BUCKET;
    this.s3 = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      // Bucket in the path, not the host name: works with every S3-compatible store.
      forcePathStyle: true,
      // By default the SDK adds a checksum to presigned uploads, computed for an
      // empty body, so every real upload would fail with BadDigest.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  presignUpload(
    key: string,
    contentType: string,
    size: number,
    expiresInSeconds: number,
  ) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });
    // Signing both headers makes the store reject any other size or type.
    return getSignedUrl(this.s3, command, {
      expiresIn: expiresInSeconds,
      signableHeaders: new Set(['content-type', 'content-length']),
    });
  }

  get(key: string): Promise<Uint8Array> {
    return this.measure('get', async () => {
      const res = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!res.Body) throw new Error('Stored object has no body');
      return res.Body.transformToByteArray();
    });
  }

  head(key: string): Promise<StoredObject | null> {
    return this.measure('head', async () => {
      try {
        const res = await this.s3.send(
          new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
        );
        return { size: res.ContentLength ?? 0, contentType: res.ContentType };
      } catch (error) {
        if (
          error instanceof S3ServiceException &&
          error.$metadata.httpStatusCode === 404
        ) {
          return null;
        }
        throw error;
      }
    });
  }

  async delete(key: string) {
    await this.measure('delete', () =>
      this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })),
    );
  }

  private async measure<T>(
    operation: 'get' | 'head' | 'delete',
    call: () => Promise<T>,
  ): Promise<T> {
    const stop = this.metrics.storageDuration.startTimer({ operation });
    let outcome: 'ok' | 'error' = 'error';
    try {
      const result = await call();
      outcome = 'ok';
      return result;
    } finally {
      stop({ outcome });
      this.metrics.storageRequests.inc({ operation, outcome });
    }
  }
}
