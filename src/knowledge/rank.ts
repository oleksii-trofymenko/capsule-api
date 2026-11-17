/** The most a passage can gain for being new: a near tie goes to the newer one. */
const RECENCY_WEIGHT = 0.05;
/** The recency bonus halves every two years. */
const HALF_LIFE_YEARS = 2;
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export interface Ranked {
  /** Cosine similarity to the query, from -1 to 1. */
  similarity: number;
  /** ISO date, YYYY-MM-DD. */
  publishedOn: string;
}

/**
 * Orders passages by relevance, preferring recent ones when they are about as
 * relevant: an older passage that is clearly more similar still comes first.
 */
export function rank<T extends Ranked>(
  passages: T[],
  now: Date,
): (T & { score: number })[] {
  return passages
    .map((p) => {
      const ageYears = Math.max(
        0,
        (now.getTime() - Date.parse(p.publishedOn)) / MS_PER_YEAR,
      );
      const recency = RECENCY_WEIGHT * 2 ** (-ageYears / HALF_LIFE_YEARS);
      return { ...p, score: p.similarity + recency };
    })
    .sort((a, b) => b.score - a.score);
}
