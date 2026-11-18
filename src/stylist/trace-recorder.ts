import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { BaseMessage } from '@langchain/core/messages';
import type { LLMResult } from '@langchain/core/outputs';
import type { TraceCall } from '../traces/traces.schemas.js';

/**
 * Collects every model call of one stylist run: the graph step that made it,
 * the messages exactly as the model received them, and what it returned.
 */
export class TraceRecorder extends BaseCallbackHandler {
  name = 'capsule-trace';
  readonly calls: TraceCall[] = [];
  private readonly open = new Map<string, TraceCall>();

  override handleChatModelStart(
    _llm: unknown,
    messages: BaseMessage[][],
    runId: string,
    _parentRunId?: string,
    _extraParams?: Record<string, unknown>,
    _tags?: string[],
    metadata?: Record<string, unknown>,
  ) {
    const node = metadata?.langgraph_node;
    const call: TraceCall = {
      step: typeof node === 'string' ? node : 'unknown',
      messages: (messages[0] ?? []).map((m) => ({
        role: m.getType(),
        text: m.text,
      })),
      output: null,
      failed: false,
    };
    this.open.set(runId, call);
    this.calls.push(call);
  }

  override handleLLMEnd(output: LLMResult, runId: string) {
    const call = this.open.get(runId);
    this.open.delete(runId);
    if (!call) return;
    const generation = output.generations[0]?.[0] as
      | { text: string; message?: { tool_calls?: { args: unknown }[] } }
      | undefined;
    const toolCalls = generation?.message?.tool_calls ?? [];
    // Structured output arrives as tool-call arguments, a reply as text.
    call.output =
      toolCalls.length > 0
        ? JSON.stringify(toolCalls.map((t) => t.args))
        : (generation?.text ?? '');
  }

  override handleLLMError(_error: unknown, runId: string) {
    const call = this.open.get(runId);
    this.open.delete(runId);
    // The error text can hold provider internals; the trace only says it failed.
    if (call) call.failed = true;
  }
}
