import { Inject, Injectable } from '@nestjs/common';
import { and, cosineDistance, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { DB, type Db } from '../db/db.module.js';
import {
  EMBEDDING_DIMENSIONS,
  knowledgePassages,
  knowledgeSources,
  type SEASONS,
} from '../db/schema.js';
import { ModelRouter } from '../models/model-router.service.js';
import { chunk } from './chunk.js';
import { rank } from './rank.js';

type Season = (typeof SEASONS)[number];

/** The embedding model reads only so much; addDocument splits longer text (see chunk.ts). */
export const MAX_PASSAGE_CHARS = 2000;

export interface NewSource {
  name: string;
  url: string | null;
  licence: string;
}

export interface NewPassage {
  sourceId: string;
  text: string;
  /** ISO date, YYYY-MM-DD. */
  publishedOn: string;
  seasons?: Season[];
}

export interface KnowledgeHit {
  id: string;
  text: string;
  publishedOn: string;
  seasons: Season[];
  source: { name: string; url: string | null; licence: string };
  similarity: number;
  score: number;
}

/**
 * The shared knowledge base: passages from licensed sources, searched by
 * meaning. It holds no user data, so queries do not filter by user.
 */
@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ModelRouter) private readonly models: ModelRouter,
  ) {}

  /**
   * The source with this name, added if it is new. A known name with a
   * different licence is refused: which licence holds is a person's decision.
   */
  async addSource(source: NewSource): Promise<string> {
    await this.db
      .insert(knowledgeSources)
      .values(source)
      .onConflictDoNothing({ target: knowledgeSources.name });
    const [row] = await this.db
      .select({ id: knowledgeSources.id, licence: knowledgeSources.licence })
      .from(knowledgeSources)
      .where(eq(knowledgeSources.name, source.name));
    if (row.licence !== source.licence) {
      throw new Error(
        `The source "${source.name}" is already recorded with the licence "${row.licence}", not "${source.licence}"`,
      );
    }
    return row.id;
  }

  async addPassage(passage: NewPassage): Promise<string> {
    return (await this.store(passage)).id;
  }

  /**
   * Splits a document into passages and adds the ones the source does not
   * have yet. Re-running it, also after a failure part-way, adds only what is missing.
   */
  async addDocument(
    document: Omit<NewPassage, 'sourceId'> & { source: NewSource },
  ): Promise<{ sourceId: string; added: number; skipped: number }> {
    const sourceId = await this.addSource(document.source);
    const passages = chunk(document.text);
    let added = 0;
    for (const text of passages) {
      const stored = await this.store({ ...document, sourceId, text });
      if (stored.added) added += 1;
    }
    return { sourceId, added, skipped: passages.length - added };
  }

  /** Embeds and inserts a passage, unless the source already has it: then no model call is made. */
  private async store(
    passage: NewPassage,
  ): Promise<{ id: string; added: boolean }> {
    const text = passage.text.trim();
    if (text.length === 0 || text.length > MAX_PASSAGE_CHARS) {
      throw new RangeError(
        `A passage must have 1 to ${MAX_PASSAGE_CHARS} characters; this one has ${text.length}`,
      );
    }
    const key = {
      sourceId: passage.sourceId,
      textHash: createHash('sha256').update(text).digest('hex'),
      publishedOn: passage.publishedOn,
    };
    const [existing] = await this.db
      .select({ id: knowledgePassages.id })
      .from(knowledgePassages)
      .where(
        and(
          eq(knowledgePassages.sourceId, key.sourceId),
          eq(knowledgePassages.textHash, key.textHash),
          eq(knowledgePassages.publishedOn, key.publishedOn),
        ),
      );
    if (existing) return { id: existing.id, added: false };

    const embedding = this.checked(
      await this.models.embeddings().embedDocuments([text]),
    )[0];
    const [row] = await this.db
      .insert(knowledgePassages)
      .values({
        ...key,
        text,
        seasons: passage.seasons ?? [],
        embedding,
        embeddingModel: this.modelName(),
      })
      .returning({ id: knowledgePassages.id });
    return { id: row.id, added: true };
  }

  /**
   * The passages most relevant to the query, recent ones preferred. Only rows
   * embedded by the current model are compared. With a season, passages for
   * other seasons are left out; passages with no seasons always qualify.
   */
  async search(
    query: string,
    options: { limit?: number; season?: Season; now?: Date } = {},
  ): Promise<KnowledgeHit[]> {
    const limit = options.limit ?? 5;
    const [vector] = this.checked([
      await this.models.embeddings().embedQuery(query),
    ]);
    const distance = cosineDistance(knowledgePassages.embedding, vector);
    const seasonFilter = options.season
      ? sql`(cardinality(${knowledgePassages.seasons}) = 0 or ${options.season} = any(${knowledgePassages.seasons}))`
      : undefined;
    // Recency re-ranks a wider pool than is returned, so a slightly less similar new passage can rise.
    const rows = await this.db
      .select({
        id: knowledgePassages.id,
        text: knowledgePassages.text,
        publishedOn: knowledgePassages.publishedOn,
        seasons: knowledgePassages.seasons,
        sourceName: knowledgeSources.name,
        sourceUrl: knowledgeSources.url,
        licence: knowledgeSources.licence,
        distance,
      })
      .from(knowledgePassages)
      .innerJoin(
        knowledgeSources,
        eq(knowledgePassages.sourceId, knowledgeSources.id),
      )
      .where(
        and(
          eq(knowledgePassages.embeddingModel, this.modelName()),
          seasonFilter,
        ),
      )
      .orderBy(distance)
      .limit(Math.max(limit * 4, 20));

    const ranked = rank(
      rows.map((r) => ({ ...r, similarity: 1 - Number(r.distance) })),
      options.now ?? new Date(),
    );
    return ranked.slice(0, limit).map((r) => ({
      id: r.id,
      text: r.text,
      publishedOn: r.publishedOn,
      seasons: r.seasons,
      source: { name: r.sourceName, url: r.sourceUrl, licence: r.licence },
      similarity: r.similarity,
      score: r.score,
    }));
  }

  private modelName() {
    const { provider, model } = this.models.describe().embedding;
    return `${provider}:${model}`;
  }

  /** Fails clearly when the configured model's vectors do not fit the column. */
  private checked(vectors: number[][]): number[][] {
    const wrong = vectors.find((v) => v.length !== EMBEDDING_DIMENSIONS);
    if (wrong) {
      throw new Error(
        `The embedding model ${this.modelName()} returns ${wrong.length} numbers, but the knowledge base stores ${EMBEDDING_DIMENSIONS}. A different embedding model needs a migration.`,
      );
    }
    return vectors;
  }
}
