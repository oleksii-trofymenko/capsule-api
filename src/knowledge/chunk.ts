/**
 * Small passages retrieve more precisely than long ones, and stay well inside
 * what the embedding model reads (MAX_PASSAGE_CHARS).
 */
export const CHUNK_CHARS = 1000;

/**
 * Splits a document into passages of at most CHUNK_CHARS: whole paragraphs
 * where they fit, then sentences, then words. Deterministic, because
 * re-ingesting a document recognises its passages by their exact text.
 */
export function chunk(text: string): string[] {
  const pieces = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0)
    .flatMap((p) => split(p, /(?<=[.!?])\s+/))
    .flatMap((p) => split(p, /\s+/))
    .flatMap(hardSplit);

  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (current && current.length + 1 + piece.length > CHUNK_CHARS) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current} ${piece}` : piece;
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Breaks only an over-long piece; chunk() packs the parts back together. */
function split(piece: string, separator: RegExp): string[] {
  return piece.length <= CHUNK_CHARS ? [piece] : piece.split(separator);
}

/** A single "word" longer than a chunk (a URL, a table squeezed flat) is cut by length. */
function hardSplit(piece: string): string[] {
  const parts: string[] = [];
  for (let i = 0; i < piece.length; i += CHUNK_CHARS) {
    parts.push(piece.slice(i, i + CHUNK_CHARS));
  }
  return parts;
}
