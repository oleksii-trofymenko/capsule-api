import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { LLMResult } from '@langchain/core/outputs';
import type { MetricsService } from '../metrics/metrics.service.js';

interface Labels {
  task: string;
  provider: string;
  model: string;
}

/** Records count, latency and token usage for every call made through a routed model. */
export class LlmMetricsCallback extends BaseCallbackHandler {
  name = 'capsule-llm-metrics';
  private readonly started = new Map<string, bigint>();

  constructor(
    private readonly metrics: MetricsService,
    private readonly labels: Labels,
  ) {
    super();
  }

  override handleLLMStart(_llm: unknown, _prompts: string[], runId: string) {
    this.started.set(runId, process.hrtime.bigint());
  }

  override handleChatModelStart(
    _llm: unknown,
    _messages: unknown[][],
    runId: string,
  ) {
    this.started.set(runId, process.hrtime.bigint());
  }

  override handleLLMEnd(output: LLMResult, runId: string) {
    this.finish(runId, 'success');
    const usage = (
      output.generations[0]?.[0] as
        | {
            message?: {
              usage_metadata?: {
                input_tokens?: number;
                output_tokens?: number;
              };
            };
          }
        | undefined
    )?.message?.usage_metadata;
    if (usage?.input_tokens) {
      this.metrics.llmTokens.inc(
        { ...this.labels, direction: 'input' },
        usage.input_tokens,
      );
    }
    if (usage?.output_tokens) {
      this.metrics.llmTokens.inc(
        { ...this.labels, direction: 'output' },
        usage.output_tokens,
      );
    }
  }

  override handleLLMError(_err: Error, runId: string) {
    this.finish(runId, 'error');
  }

  private finish(runId: string, outcome: 'success' | 'error') {
    const start = this.started.get(runId);
    this.started.delete(runId);
    const labels = { ...this.labels, outcome };
    this.metrics.llmRequests.inc(labels);
    if (start !== undefined) {
      this.metrics.llmDuration.observe(
        labels,
        Number(process.hrtime.bigint() - start) / 1e9,
      );
    }
  }
}
