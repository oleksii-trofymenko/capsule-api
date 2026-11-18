import type { NewNote } from './memory.schemas.js';

/** Where the stylist keeps what a person tells it. The app uses the database; the evaluation keeps notes in memory. */
export interface NoteStore {
  add(userId: string, notes: NewNote[]): Promise<void>;
}

export const NOTE_STORE = Symbol('NOTE_STORE');
