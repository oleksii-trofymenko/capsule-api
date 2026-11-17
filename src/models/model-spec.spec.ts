import { parseModelSpec } from './model-spec.js';

describe('parseModelSpec', () => {
  it('splits on the first colon only, keeping model tags intact', () => {
    expect(parseModelSpec('ollama:gemma4:12b')).toEqual({
      provider: 'ollama',
      model: 'gemma4:12b',
    });
  });

  it('accepts a model without a tag', () => {
    expect(parseModelSpec('ollama:nomic-embed-text')).toEqual({
      provider: 'ollama',
      model: 'nomic-embed-text',
    });
  });

  it.each(['', 'gemma4', ':gemma4', 'ollama:', ' : '])(
    'rejects %j',
    (value) => {
      expect(() => parseModelSpec(value)).toThrow(/expected "provider:model"/);
    },
  );
});
