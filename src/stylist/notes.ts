import { newNoteSchema, type NewNote } from '../memory/memory.schemas.js';
import { normalise } from '../occasions/normalise.js';
import type { Understanding } from './stylist.schemas.js';

/**
 * The notes worth keeping from one message: valid ones only, at most three,
 * and only when the message itself speaks of something lasting ("I never",
 * "I love", "my size"). Small models also note one-off reactions such as "it
 * was the blazer", and a stored dislike bans items for good, so this is
 * checked in code.
 */
export function notesToKeep(
  remember: Understanding['remember'],
  message: string,
  lastingWords: string[],
): NewNote[] {
  const text = ` ${normalise(message)} `;
  if (!lastingWords.some((w) => text.includes(` ${normalise(w)} `))) return [];
  return remember
    .flatMap((n) => {
      const note = newNoteSchema.safeParse(n);
      return note.success ? [note.data] : [];
    })
    .slice(0, 3);
}
