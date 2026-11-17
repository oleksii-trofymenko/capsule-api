import { tool, type StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { sampleOccasions, sampleWardrobe } from './sample-data.js';

const SEASONS = [
  'winter',
  'winter',
  'spring',
  'spring',
  'spring',
  'summer',
  'summer',
  'summer',
  'autumn',
  'autumn',
  'autumn',
  'winter',
] as const;

/** Tools are plain in-process functions (no MCP yet). `now` is injectable for tests. */
export function createPlaygroundTools(
  now: () => Date = () => new Date(),
): StructuredToolInterface[] {
  const getToday = tool(
    () => {
      const d = now();
      return JSON.stringify({
        date: d.toISOString().slice(0, 10),
        weekday: d.toLocaleDateString('en-GB', {
          weekday: 'long',
          timeZone: 'UTC',
        }),
        season: SEASONS[d.getUTCMonth()],
        hemisphere: 'northern',
      });
    },
    {
      name: 'get_today',
      description:
        "Returns today's date, weekday and season. Call this before giving seasonal advice.",
      schema: z.object({}),
    },
  );

  const searchWardrobe = tool(
    ({ query, category }) => {
      const words = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
      const items = sampleWardrobe.filter((item) => {
        if (category && item.category !== category) return false;
        if (words.length === 0) return true;
        const text =
          `${item.name} ${item.colour} ${item.formality} ${item.seasons.join(' ')}`.toLowerCase();
        return words.some((w) => text.includes(w));
      });
      return JSON.stringify({ count: items.length, items });
    },
    {
      name: 'search_wardrobe',
      description:
        'Lists clothes the person owns. Filter by category, and optionally by words such as a colour, a season or "formal". Call with no arguments to list everything.',
      schema: z.object({
        query: z
          .string()
          .max(100)
          .optional()
          .describe('Words to match, e.g. "navy" or "winter formal"'),
        category: z
          .enum(['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'])
          .optional(),
      }),
    },
  );

  const getDressCode = tool(
    ({ occasion }) => {
      const key = occasion.trim().toLowerCase();
      const found = sampleOccasions[key];
      if (!found) {
        return JSON.stringify({
          found: false,
          known: Object.keys(sampleOccasions),
        });
      }
      return JSON.stringify({ found: true, occasion: key, ...found });
    },
    {
      name: 'get_dress_code',
      description:
        'Returns the dress code and firm rules for an occasion. Known occasions: ' +
        Object.keys(sampleOccasions).join(', ') +
        '.',
      schema: z.object({ occasion: z.string().min(1).max(60) }),
    },
  );

  return [getToday, searchWardrobe, getDressCode];
}
