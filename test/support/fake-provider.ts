import type { Embeddings } from '@langchain/core/embeddings';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  FakeEmbeddings,
  FakeListChatModel,
} from '@langchain/core/utils/testing';
import type { ModelProvider } from '../../src/models/providers/model-provider.js';

export class FakeProvider implements ModelProvider {
  readonly id = 'ollama';
  /** Pass `model` to script exact behaviour, for example tool calls; `embedder` for meaningful vectors. */
  constructor(
    private readonly responses: string[] = ['ok'],
    private readonly model?: BaseChatModel,
    private readonly embedder?: Embeddings,
  ) {}

  chat(): BaseChatModel {
    return this.model ?? new FakeListChatModel({ responses: this.responses });
  }
  embeddings(): Embeddings {
    return this.embedder ?? new FakeEmbeddings();
  }
  async health() {
    return { ok: true, detail: 'fake' };
  }
}
