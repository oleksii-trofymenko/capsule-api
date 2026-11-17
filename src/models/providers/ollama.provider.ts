import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import type { ModelProvider, ProviderHealth } from './model-provider.js';

export class OllamaProvider implements ModelProvider {
  readonly id = 'ollama';

  constructor(private readonly baseUrl: string) {}

  chat(model: string) {
    return new ChatOllama({ baseUrl: this.baseUrl, model, temperature: 0.2 });
  }

  embeddings(model: string) {
    return new OllamaEmbeddings({ baseUrl: this.baseUrl, model });
  }

  async health(): Promise<ProviderHealth> {
    try {
      const res = await fetch(new URL('/api/version', this.baseUrl), {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
      const body = (await res.json()) as { version?: string };
      return {
        ok: true,
        detail: body.version ? `ollama ${body.version}` : undefined,
      };
    } catch {
      return { ok: false, detail: 'unreachable' };
    }
  }
}
