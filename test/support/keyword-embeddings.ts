import { Embeddings } from '@langchain/core/embeddings';

/**
 * Deterministic embeddings for tests: each word of three or more letters is hashed into one of the
 * vector's slots, so texts that share words point the same way. Crude, but it
 * makes "search returns relevant passages" testable without a model.
 */
export class KeywordEmbeddings extends Embeddings {
  constructor(private readonly dimensions = 768) {
    super({});
  }

  async embedQuery(text: string): Promise<number[]> {
    const vector = new Array<number>(this.dimensions).fill(0);
    // Short words ("a", "at") carry no meaning here; a plural "s" should not split a word in two.
    const words = (text.toLowerCase().match(/[a-z]{3,}/g) ?? []).map((w) =>
      w.endsWith('s') ? w.slice(0, -1) : w,
    );
    for (const word of words) {
      let hash = 0;
      for (const char of word) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
      vector[hash % this.dimensions] += 1;
    }
    const length = Math.hypot(...vector) || 1;
    return vector.map((v) => v / length);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embedQuery(t)));
  }
}
