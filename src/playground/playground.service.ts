import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { concat } from '@langchain/core/utils/stream';
import { Inject, Injectable } from '@nestjs/common';
import { ModelRouter } from '../models/model-router.service.js';
import type { ChatEvent, ChatRequest } from './playground.schemas.js';
import { createPlaygroundTools } from './playground.tools.js';
import { systemPrompts } from './prompts/system.js';

/** Stops a model that keeps calling tools without ever answering. */
const MAX_MODEL_CALLS = 6;
/** Tool output is echoed to the browser; keep one runaway result from flooding it. */
const MAX_RESULT_CHARS = 4000;

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part: unknown) =>
      typeof part === 'object' &&
      part !== null &&
      'text' in part &&
      typeof part.text === 'string'
        ? part.text
        : '',
    )
    .join('');
}

@Injectable()
export class PlaygroundService {
  private readonly tools: StructuredToolInterface[] = createPlaygroundTools();

  constructor(@Inject(ModelRouter) private readonly models: ModelRouter) {}

  /**
   * A plain tool-calling loop: ask the model, run any tools it requests, feed
   * the results back, repeat until it answers in text. Every step is yielded
   * so the client can show exactly what happened.
   */
  async *chat(
    request: ChatRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatEvent> {
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    const route = this.models.describe().reasoning;
    const systemPrompt = request.systemPrompt?.trim() || systemPrompts.en;
    const tools = request.tools ? this.tools : [];

    yield {
      type: 'start',
      provider: route.provider,
      model: route.model,
      tools: tools.map((t) => t.name),
      systemPrompt,
    };

    const base = this.models.chat('reasoning');
    const model =
      tools.length > 0 && base.bindTools ? base.bindTools(tools) : base;

    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...request.messages.map((m) =>
        m.role === 'user'
          ? new HumanMessage(m.content)
          : new AIMessage(m.content),
      ),
    ];

    let firstTokenMs: number | null = null;
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let modelCalls = 0;

    try {
      while (modelCalls < MAX_MODEL_CALLS) {
        modelCalls += 1;
        let answer: AIMessageChunk | undefined;

        for await (const chunk of await model.stream(messages, { signal })) {
          answer = answer ? concat(answer, chunk) : chunk;
          const text = textOf(chunk.content);
          if (text) {
            firstTokenMs ??= elapsed();
            yield { type: 'token', text };
          }
        }
        if (!answer) break;

        const usage = answer.usage_metadata;
        if (usage) {
          inputTokens = (inputTokens ?? 0) + (usage.input_tokens ?? 0);
          outputTokens = (outputTokens ?? 0) + (usage.output_tokens ?? 0);
        }

        messages.push(answer);
        const calls = answer.tool_calls ?? [];
        if (calls.length === 0) break;

        for (const [index, call] of calls.entries()) {
          const id = call.id ?? `call_${modelCalls}_${index}`;
          yield { type: 'tool_call', id, name: call.name, args: call.args };

          const toolStarted = performance.now();
          const found = tools.find((t) => t.name === call.name);
          let ok = true;
          let result: string;
          try {
            if (!found) throw new Error(`Unknown tool "${call.name}"`);
            result =
              textOf(await found.invoke(call.args, { signal })) ||
              '(empty result)';
          } catch (error) {
            // Report the failure to the model too, so it can correct itself or apologise.
            ok = false;
            result = `Tool failed: ${error instanceof Error ? error.message : 'unknown error'}`;
          }
          result = result.slice(0, MAX_RESULT_CHARS);
          messages.push(
            new ToolMessage({
              content: result,
              tool_call_id: id,
              name: call.name,
            }),
          );
          yield {
            type: 'tool_result',
            id,
            name: call.name,
            ok,
            result,
            ms: Math.round(performance.now() - toolStarted),
          };
        }
      }

      yield {
        type: 'done',
        ms: elapsed(),
        firstTokenMs,
        modelCalls,
        inputTokens,
        outputTokens,
      };
    } catch (error) {
      if (signal?.aborted) return;
      // The provider's message is useful here ("model not found", "connection refused"),
      // and this endpoint is a developer tool that is disabled in production.
      const message =
        error instanceof Error ? error.message : 'The model call failed';
      yield { type: 'error', message: message.slice(0, 500) };
    }
  }
}
