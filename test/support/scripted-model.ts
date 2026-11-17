import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessageChunk, type BaseMessage } from '@langchain/core/messages';
import { ChatGenerationChunk, type ChatResult } from '@langchain/core/outputs';

export type ScriptStep = AIMessageChunk[] | Error;

/** A chunk that asks for one tool call, as a real model would stream it. */
export function toolCallChunk(
  name: string,
  args: object,
  id = `call_${name}`,
): AIMessageChunk {
  return new AIMessageChunk({
    content: '',
    tool_call_chunks: [
      {
        name,
        args: JSON.stringify(args),
        id,
        index: 0,
        type: 'tool_call_chunk',
      },
    ],
  });
}

export const textChunks = (...parts: string[]) =>
  parts.map((p) => new AIMessageChunk(p));

/**
 * A chat model that plays back a script: one step per model call. It records
 * what it was sent, so tests can assert on the conversation the model saw.
 */
export class ScriptedChatModel extends BaseChatModel {
  readonly received: BaseMessage[][] = [];
  boundTools: string[] | null = null;

  constructor(
    private readonly script: ScriptStep[],
    /** Used when the script runs out; lets a test model "never stop calling tools". */
    private readonly fallback?: ScriptStep,
  ) {
    super({});
  }

  _llmType() {
    return 'scripted';
  }

  override bindTools(tools: { name?: string }[]) {
    this.boundTools = tools.map((t) => t.name ?? '?');
    return this;
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    let message = new AIMessageChunk('');
    for await (const chunk of this._streamResponseChunks(messages)) {
      message = message.concat(chunk.message as AIMessageChunk);
    }
    // Return the chunk itself: it keeps tool calls, which withStructuredOutput reads.
    return { generations: [{ text: message.text, message }] };
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
  ): AsyncGenerator<ChatGenerationChunk> {
    this.received.push([...messages]);
    const step = this.script.shift() ?? this.fallback ?? textChunks('');
    if (step instanceof Error) throw step;
    for (const message of step) {
      yield new ChatGenerationChunk({
        message,
        text: typeof message.content === 'string' ? message.content : '',
      });
    }
  }
}
