import { z } from 'zod';
import { NOTE_KINDS } from '../db/schema.js';

/** Longest note kept: a short phrase, never a transcript. */
export const MAX_NOTE_CHARS = 120;

export const noteIdSchema = z.uuid();

/** A note as the stylist proposes it. Model output, so it is validated before it is stored. */
export const newNoteSchema = z.object({
  kind: z.enum(NOTE_KINDS),
  text: z.string().trim().min(1).max(MAX_NOTE_CHARS),
});

export const noteSchema = newNoteSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
});

export const notesSchema = z.object({ notes: z.array(noteSchema) });

export type NewNote = z.infer<typeof newNoteSchema>;
export type Note = z.infer<typeof noteSchema>;
