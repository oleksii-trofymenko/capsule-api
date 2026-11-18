import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { personalNotes } from '../db/schema.js';
import type { NewNote, Note } from './memory.schemas.js';
import type { NoteStore } from './note-store.js';

/** Notes kept per person; the oldest go first. Every note is sent to the model on each turn. */
export const MAX_NOTES = 50;

@Injectable()
export class MemoryService implements NoteStore {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Newest first. */
  async list(userId: string): Promise<Note[]> {
    const rows = await this.db
      .select()
      .from(personalNotes)
      .where(eq(personalNotes.userId, userId))
      .orderBy(desc(personalNotes.createdAt), desc(personalNotes.id));
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Keeps new notes. The latest word on a thing wins, in any letter case: "I
   * love navy" replaces an earlier navy dislike. Then trims to MAX_NOTES.
   */
  async add(userId: string, notes: NewNote[]): Promise<void> {
    const latest = [
      ...new Map(notes.map((n) => [n.text.toLowerCase(), n])).values(),
    ];
    if (latest.length === 0) return;
    await this.db.transaction(async (tx) => {
      await tx.delete(personalNotes).where(
        and(
          eq(personalNotes.userId, userId),
          inArray(
            sql`lower(${personalNotes.text})`,
            latest.map((n) => n.text.toLowerCase()),
          ),
        ),
      );
      await tx
        .insert(personalNotes)
        .values(latest.map((n) => ({ userId, ...n })));
    });
    const overflow = (await this.list(userId)).slice(MAX_NOTES);
    if (overflow.length > 0) {
      await this.db.delete(personalNotes).where(
        and(
          eq(personalNotes.userId, userId),
          inArray(
            personalNotes.id,
            overflow.map((n) => n.id),
          ),
        ),
      );
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(personalNotes)
      .where(and(eq(personalNotes.id, id), eq(personalNotes.userId, userId)))
      .returning({ id: personalNotes.id });
    if (deleted.length === 0) throw new NotFoundException('Note not found');
  }

  async clear(userId: string): Promise<void> {
    await this.db.delete(personalNotes).where(eq(personalNotes.userId, userId));
  }
}
