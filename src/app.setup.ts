import {
  INestApplication,
  StandardSchemaValidationPipe,
  VersioningType,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import helmet from 'helmet';
import { ENV } from './config/config.module.js';
import type { Env } from './config/env.js';
import { httpMetrics } from './metrics/http-metrics.middleware.js';
import { MetricsService } from './metrics/metrics.service.js';

/**
 * Everything that shapes HTTP behaviour lives here, so the real server and the
 * e2e tests run exactly the same configuration.
 */
export function configureApp(app: INestApplication): void {
  const env = app.get<Env>(ENV);
  const express = app as NestExpressApplication;

  app.use(httpMetrics(app.get(MetricsService)));
  app.use(helmet());
  express.disable('x-powered-by');
  // JSON API only: a small body limit. Photos go straight to object storage, not through here.
  express.useBodyParser('json', { limit: '100kb' });

  app.enableCors({
    // An explicit allowlist. Native mobile clients send no Origin header and are unaffected.
    origin: env.CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableShutdownHooks();
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Capsule API')
    .setDescription('Backend for Capsule, the AI wardrobe stylist.')
    .setVersion('1')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}
