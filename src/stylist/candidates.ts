import type { NEVER_WEAR, SEASONS } from '../db/schema.js';
import { checkOutfit, mentions } from '../occasions/check-outfit.js';
import type { Rule } from '../occasions/occasion.schemas.js';
import type { StylistItem } from './context.js';

type Season = (typeof SEASONS)[number];
type NeverWear = (typeof NEVER_WEAR)[number];

const SEASON_BY_MONTH: Season[] = [
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
];

/** Northern-hemisphere season for a date. Users' location is not modelled yet. */
export const seasonOf = (date: Date): Season =>
  SEASON_BY_MONTH[date.getUTCMonth()];

/**
 * Words in an English item name that mark a "never wear" answer. Logos cannot
 * be seen in a name, so that answer is left to the model.
 */
const NEVER_WEAR_WORDS: Record<NeverWear, string[]> = {
  'high-necklines': [
    'turtleneck',
    'roll-neck',
    'polo-neck',
    'high-neck',
    'mock-neck',
  ],
  sleeveless: ['sleeveless', 'tank', 'vest', 'camisole'],
  'short-hemlines': ['mini'],
  'skinny-fits': ['skinny'],
  heels: ['heel', 'stiletto', 'pump', 'court-shoe'],
  logos: [],
  'bold-patterns': [
    'floral',
    'print',
    'printed',
    'leopard',
    'zebra',
    'paisley',
  ],
};

/**
 * The items an outfit may be built from: everything the person owns, minus
 * pieces the occasion's rules or their "never wear" answers rule out. The
 * outfit-level main-colour rule is checked after composing.
 */
export function filterCandidates(
  wardrobe: StylistItem[],
  rules: Rule[],
  neverWear: NeverWear[],
): StylistItem[] {
  const perItemRules = rules.filter((r) => r.type !== 'forbidMainColour');
  const avoidWords = neverWear.flatMap((n) => NEVER_WEAR_WORDS[n]);
  return wardrobe.filter(
    (item) =>
      checkOutfit(perItemRules, [item]).length === 0 &&
      !avoidWords.some((w) => mentions(item.name, w)),
  );
}

/** An item for a prompt, without its id: "Navy wool blazer (outerwear, navy, formal; autumn, winter)". */
export const describeItem = (i: StylistItem) =>
  `${i.name} (${i.category}, ${i.colour}, ${i.formality}; ${i.seasons.join(', ')})`;
