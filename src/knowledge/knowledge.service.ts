import { Inject, Injectable } from '@nestjs/common';
import { and, cosineDistance, eq, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import {
  EMBEDDING_DIMENSIONS,
  knowledgePassages,
  knowledgeSources,
  type SEASONS,
} from '../db/schema.js';
import { ModelRouter } from '../models/model-router.service.js';
import { rank } from './rank.js';

type Season = (typeof SEASONS)[number];

/** The embedding model reads only so much; longer text must be split before it gets here (T17). */
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

  async addSource(source: NewSource): Promise<string> {
    const [row] = await this.db
      .insert(knowledgeSources)
      .values(source)
      .returning({ id: knowledgeSources.id });
    return row.id;
  }

  async addPassage(passage: NewPassage): Promise<string> {
    const text = passage.text.trim();
    if (text.length === 0 || text.length > MAX_PASSAGE_CHARS) {
      throw new RangeError(
        `A passage must have 1 to ${MAX_PASSAGE_CHARS} characters; this one has ${text.length}`,
      );
    }
    const embedding = this.checked(
      await this.models.embeddings().embedDocuments([text]),
    )[0];
    const [row] = await this.db
      .insert(knowledgePassages)
      .values({
        sourceId: passage.sourceId,
        text,
        publishedOn: passage.publishedOn,
        seasons: passage.seasons ?? [],
        embedding,
        embeddingModel: this.modelName(),
      })
      .returning({ id: knowledgePassages.id });
    return row.id;
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
