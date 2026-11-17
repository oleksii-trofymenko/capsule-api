import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { buildOpenApi, configureApp } from './app.setup.js';
import { ENV } from './config/config.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);
  const env = app.get<Env>(ENV);

  if (env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, buildOpenApi(app), {
      jsonDocumentUrl: 'docs/openapi.json',
    });
  }

  await app.listen(env.PORT);
  new Logger('Bootstrap').log(
    `capsule-api listening on :${env.PORT} (${env.NODE_ENV})`,
  );
}
await bootstrap();
