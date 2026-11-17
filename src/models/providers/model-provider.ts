import type { Embeddings } from '@langchain/core/embeddings';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface ProviderHealth {
  ok: boolean;
  detail?: string;
}

/**
 * The seam between Capsule and a model vendor. Adding a cloud provider means
 * implementing this interface and registering it in ModelsModule; nothing
 * that calls the router changes.
 */
export interface ModelProvider {
  readonly id: string;
  chat(model: string): BaseChatModel;
  embeddings(model: string): Embeddings;
  health(): Promise<ProviderHealth>;
}

export const MODEL_PROVIDERS = Symbol('MODEL_PROVIDERS');
