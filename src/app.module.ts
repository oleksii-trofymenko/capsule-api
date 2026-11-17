import { ExecutionContext, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { STRICT_RATE_LIMIT } from './auth/strict-rate-limit.decorator.js';
import { ConfigModule, ENV } from './config/config.module.js';
import type { Env } from './config/env.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { ModelsModule } from './models/models.module.js';
import { PhotosModule } from './photos/photos.module.js';
import { PlaygroundModule } from './playground/playground.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { WardrobeModule } from './wardrobe/wardrobe.module.js';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    MetricsModule,
    ThrottlerModule.forRootAsync({
      inject: [ENV, Reflector],
      useFactory: (env: Env, reflector: Reflector) => [
        {
          ttl: 60_000,
          limit: (context: ExecutionContext) =>
            reflector.get<boolean>(STRICT_RATE_LIMIT, context.getHandler())
              ? env.AUTH_RATE_LIMIT_PER_MINUTE
              : env.RATE_LIMIT_PER_MINUTE,
        },
      ],
    }),
    AuthModule,
    ModelsModule,
    PlaygroundModule,
    PhotosModule,
    WardrobeModule,
    ProfileModule,
  ],
  controllers: [HealthController],
  // Order matters: rate limiting runs before authentication.
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
