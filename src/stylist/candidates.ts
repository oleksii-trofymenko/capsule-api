import type { NEVER_WEAR, SEASONS } from '../db/schema.js';
import { checkOutfit, mentions } from '../occasions/check-outfit.js';
import { normalise } from '../occasions/normalise.js';
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
 * Whether an item's name or colour contains a disliked phrase, whole words
 * only: "yellow" rules out a "mustard yellow" top, not a "yellowstone" print.
 */
const isDisliked = (item: StylistItem, dislike: string) => {
  const phrase = normalise(dislike);
  if (phrase.length === 0) return false;
  const text = normalise(`${item.name} ${item.colour}`);
  // People dislike in plurals ("turtlenecks", "dresses"); items are named in the singular.
  const stems = [phrase, phrase.replace(/s$/, ''), phrase.replace(/es$/, '')];
  return stems.some((stem) =>
    new RegExp(`(^| )${stem}(s|es)?( |$)`).test(text),
  );
};

/**
 * The items an outfit may be built from: everything the person owns, minus
 * pieces the occasion's rules, their "never wear" answers or the dislikes
 * they told the stylist rule out. The outfit-level main-colour rule is
 * checked after composing.
 */
export function filterCandidates(
  wardrobe: StylistItem[],
  rules: Rule[],
  neverWear: NeverWear[],
  dislikes: string[],
): StylistItem[] {
  const perItemRules = rules.filter((r) => r.type !== 'forbidMainColour');
  const avoidWords = neverWear.flatMap((n) => NEVER_WEAR_WORDS[n]);
  return wardrobe.filter(
    (item) =>
      checkOutfit(perItemRules, [item]).length === 0 &&
      !avoidWords.some((w) => mentions(item.name, w)) &&
      !dislikes.some((d) => isDisliked(item, d)),
  );
}

/** An item for a prompt, without its id: "Navy wool blazer (outerwear, navy, formal; autumn, winter)". */
export const describeItem = (i: StylistItem) =>
  `${i.name} (${i.category}, ${i.colour}, ${i.formality}; ${i.seasons.join(', ')})`;
