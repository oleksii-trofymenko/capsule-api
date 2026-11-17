import { Module } from '@nestjs/common';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { ModelRouter } from './model-router.service.js';
import { ModelsController } from './models.controller.js';
import {
  MODEL_PROVIDERS,
  type ModelProvider,
} from './providers/model-provider.js';
import { OllamaProvider } from './providers/ollama.provider.js';

@Module({
  controllers: [ModelsController],
  providers: [
    {
      provide: MODEL_PROVIDERS,
      inject: [ENV],
      // Register cloud providers here later (e.g. an Anthropic provider keyed "anthropic").
      useFactory: (env: Env): ModelProvider[] => [
        new OllamaProvider(env.OLLAMA_BASE_URL),
      ],
    },
    ModelRouter,
  ],
  exports: [ModelRouter],
})
export class ModelsModule {}
