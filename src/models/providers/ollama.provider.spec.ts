import { OllamaProvider } from './ollama.provider.js';

describe('OllamaProvider', () => {
  it('turns thinking off, so replies arrive as text and quickly', () => {
    const model = new OllamaProvider('http://ollama.test:11434').chat('any');
    expect(model.think).toBe(false);
  });
});
