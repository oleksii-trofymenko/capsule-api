export const MODEL_TASKS = ['vision', 'reasoning', 'embedding'] as const;
export type ModelTask = (typeof MODEL_TASKS)[number];

export interface ModelSpec {
  provider: string;
  model: string;
}

/**
 * Parses `provider:model`. Only the first colon separates the two, because
 * model names contain colons themselves (`ollama:gemma4:12b`).
 */
export function parseModelSpec(value: string): ModelSpec {
  const at = value.indexOf(':');
  const provider = value.slice(0, at).trim();
  const model = value.slice(at + 1).trim();
  if (at <= 0 || !provider || !model) {
    throw new Error(`Invalid model spec "${value}": expected "provider:model"`);
  }
  return { provider, model };
}
