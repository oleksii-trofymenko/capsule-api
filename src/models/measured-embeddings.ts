import { Embeddings } from '@langchain/core/embeddings';
import type { MetricsService } from '../metrics/metrics.service.js';

interface Labels {
  task: string;
  provider: string;
  model: string;
}

/**
 * Embeddings that record each call's count and latency, like routed chat
 * models do. LangChain embeddings take no callbacks, so this wraps them.
 */
export class MeasuredEmbeddings extends Embeddings {
  constructor(
    private readonly inner: Embeddings,
    private readonly metrics: MetricsService,
    private readonly labels: Labels,
  ) {
    super({});
  }

  embedQuery(text: string): Promise<number[]> {
    return this.measure(() => this.inner.embedQuery(text));
  }

  embedDocuments(texts: string[]): Promise<number[][]> {
    return this.measure(() => this.inner.embedDocuments(texts));
  }

  private async measure<T>(call: () => Promise<T>): Promise<T> {
    const stop = this.metrics.llmDuration.startTimer(this.labels);
    let outcome: 'success' | 'error' = 'error';
    try {
      const result = await call();
      outcome = 'success';
      return result;
    } finally {
      stop({ outcome });
      this.metrics.llmRequests.inc({ ...this.labels, outcome });
    }
  }
}
