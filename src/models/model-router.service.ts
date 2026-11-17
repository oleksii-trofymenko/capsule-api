import type { Embeddings } from '@langchain/core/embeddings';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { LlmMetricsCallback } from './llm-metrics.callback.js';
import {
  MODEL_TASKS,
  parseModelSpec,
  type ModelSpec,
  type ModelTask,
} from './model-spec.js';
import {
  MODEL_PROVIDERS,
  type ModelProvider,
  type ProviderHealth,
} from './providers/model-provider.js';

export type ChatTask = Exclude<ModelTask, 'embedding'>;

/**
 * The only place that knows which model serves which job. Feature code asks
 * for a task ("vision", "reasoning"), never for a vendor or a model name, so
 * moving from a local model to a cloud one is an environment change.
 */
@Injectable()
export class ModelRouter {
  private readonly routes: Record<ModelTask, ModelSpec>;
  private readonly providers: Map<string, ModelProvider>;
  private readonly chatModels = new Map<ChatTask, BaseChatModel>();
  private embeddingModel?: Embeddings;

  constructor(
    @Inject(ENV) env: Env,
    @Inject(MODEL_PROVIDERS) providers: ModelProvider[],
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {
    this.providers = new Map(providers.map((p) => [p.id, p]));
    this.routes = {
      vision: parseModelSpec(env.MODEL_VISION),
      reasoning: parseModelSpec(env.MODEL_REASONING),
      embedding: parseModelSpec(env.MODEL_EMBEDDING),
    };
    // Fail at startup, not on the first user request.
    for (const task of MODEL_TASKS) this.providerFor(task);
  }

  chat(task: ChatTask): BaseChatModel {
    let model = this.chatModels.get(task);
    if (!model) {
      const spec = this.routes[task];
      model = this.providerFor(task).chat(spec.model);
      model.callbacks = [
        new LlmMetricsCallback(this.metrics, { task, ...spec }),
      ];
      this.chatModels.set(task, model);
    }
    return model;
  }

  embeddings(): Embeddings {
    const spec = this.routes.embedding;
    this.embeddingModel ??= this.providerFor('embedding').embeddings(
      spec.model,
    );
    return this.embeddingModel;
  }

  describe(): Record<ModelTask, ModelSpec> {
    return structuredClone(this.routes);
  }

  async health(): Promise<Record<string, ProviderHealth>> {
    const used = new Set(MODEL_TASKS.map((t) => this.routes[t].provider));
    const entries = await Promise.all(
      [...used].map(
        async (id) => [id, await this.providers.get(id)!.health()] as const,
      ),
    );
    return Object.fromEntries(entries);
  }

  private providerFor(task: ModelTask): ModelProvider {
    const { provider } = this.routes[task];
    const found = this.providers.get(provider);
    if (!found) {
      const known = [...this.providers.keys()].join(', ') || 'none';
      throw new Error(
        `MODEL_${task.toUpperCase()} uses unknown provider "${provider}" (registered: ${known})`,
      );
    }
    return found;
  }
}
