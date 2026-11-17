import { Module } from '@nestjs/common';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { OBJECT_STORAGE } from './object-storage.js';
import { S3ObjectStorage } from './s3-object-storage.js';

@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ENV, MetricsService],
      useFactory: (env: Env, metrics: MetricsService) =>
        new S3ObjectStorage(env, metrics),
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
