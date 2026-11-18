import { chunk, CHUNK_CHARS } from './chunk.js';

describe('chunk', () => {
  it('keeps short paragraphs together in one passage, with whitespace tidied', () => {
    expect(chunk('  Linen  creases.\n\n\n Wool\nwarms.  ')).toEqual([
      'Linen creases. Wool warms.',
    ]);
  });

  it('starts a new passage at a paragraph boundary when the next would not fit', () => {
    const a = 'a'.repeat(600);
    const b = 'b'.repeat(600);
    expect(chunk(`${a}\n\n${b}`)).toEqual([a, b]);
  });

  it('splits a paragraph with no blank lines at sentence ends', () => {
    const sentence = `${'word '.repeat(59)}end.`;
    const page = Array.from({ length: 10 }, () => sentence).join(' ');
    const passages = chunk(page);
    expect(passages.length).toBeGreaterThan(1);
    for (const p of passages) {
      expect(p.length).toBeLessThanOrEqual(CHUNK_CHARS);
      expect(p.endsWith('end.')).toBe(true);
    }
    expect(passages.join(' ')).toBe(page);
  });

  it('cuts a single over-long word by length', () => {
    const passages = chunk('x'.repeat(CHUNK_CHARS * 2 + 5));
    expect(passages.map((p) => p.length)).toEqual([
      CHUNK_CHARS,
      CHUNK_CHARS,
      5,
    ]);
  });

  it('returns nothing for blank text and the same passages every time', () => {
    expect(chunk(' \n\n ')).toEqual([]);
    const text = 'One. '.repeat(500);
    expect(chunk(text)).toEqual(chunk(text));
  });
});
