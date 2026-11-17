/**
 * Writes openapi.json without starting the HTTP server or touching the database.
 * capsule-web and capsule-mobile generate their typed clients from this file.
 */
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { buildOpenApi, configureApp } from './app.setup.js';

process.env.DATABASE_URL ??= 'postgres://unused:unused@localhost:5432/unused';
process.env.JWT_ACCESS_SECRET ??= 'openapi-generation-only-not-a-real-secret';

const app = await NestFactory.create(AppModule, {
  logger: ['error'],
  bodyParser: false,
});
configureApp(app);
await app.init();
writeFileSync(
  'openapi.json',
  JSON.stringify(buildOpenApi(app), null, 2) + '\n',
);
await app.close();
console.log('Wrote openapi.json');
