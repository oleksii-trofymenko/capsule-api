import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  FakeEmbeddings,
  FakeListChatModel,
} from '@langchain/core/utils/testing';
import type { ModelProvider } from '../../src/models/providers/model-provider.js';

export class FakeProvider implements ModelProvider {
  readonly id = 'ollama';
  /** Pass `model` to script exact behaviour, for example tool calls. */
  constructor(
    private readonly responses: string[] = ['ok'],
    private readonly model?: BaseChatModel,
  ) {}

  chat(): BaseChatModel {
    return this.model ?? new FakeListChatModel({ responses: this.responses });
  }
  embeddings() {
    return new FakeEmbeddings();
  }
  async health() {
    return { ok: true, detail: 'fake' };
  }
}
