import type { CATEGORIES, FORMALITIES } from '../db/schema.js';
import { normalise } from './normalise.js';
import type { Rule } from './occasion.schemas.js';

/** The fields of a wardrobe item that occasion rules look at. */
export interface OutfitItem {
  name: string;
  category: (typeof CATEGORIES)[number];
  colour: string;
  formality: (typeof FORMALITIES)[number];
}

export interface Violation {
  ruleId: string;
  /** The items that break the rule. */
  items: string[];
}

const RANK = { casual: 0, smart: 1, formal: 2 } as const;
/** The garment that sets an outfit's main colour, in order of precedence. */
const MAIN_COLOUR_FROM = ['dress', 'outerwear', 'top'] as const;

/**
 * A rule word as a pattern on normalised text: a hyphen may be a space or
 * nothing ("t-shirt", "t shirt", "tshirt"). Rule words are lower-case letters
 * and hyphens only (enforced by the data schema), so nothing needs escaping.
 */
const pattern = (word: string) => word.split('-').join(' ?');

/** A whole word, or that word with a plural ending: "trainer" matches "Trainers" but not "trainerish". */
export function mentions(text: string, word: string): boolean {
  return new RegExp(`(^| )${pattern(word)}(s|es)?( |$)`).test(normalise(text));
}

/** A colour is read by its leading words: "black and white" is black, "off-white" is off-white. */
const leadsWith = (colour: string, word: string) =>
  new RegExp(`^${pattern(word)}(s|es)?( |$)`).test(normalise(colour));

const anyMentioned = (text: string, list: string[]) =>
  list.some((word) => mentions(text, word));
const anyLeading = (colour: string, list: string[]) =>
  list.some((word) => leadsWith(colour, word));

function breaking(rule: Rule, items: OutfitItem[]): OutfitItem[] {
  switch (rule.type) {
    case 'minFormality':
      return items.filter((i) => RANK[i.formality] < RANK[rule.level]);
    case 'maxFormality':
      return items.filter((i) => RANK[i.formality] > RANK[rule.level]);
    case 'forbidItems':
      return items.filter((i) => anyMentioned(i.name, rule.words));
    case 'forbidMainColour': {
      // Every item of the garment type that sets the main colour, so order does not matter.
      const category = MAIN_COLOUR_FROM.find((c) =>
        items.some((i) => i.category === c),
      );
      return items.filter(
        (i) => i.category === category && anyLeading(i.colour, rule.colours),
      );
    }
    case 'onlyColours':
      return items.filter(
        (i) =>
          rule.categories.includes(i.category) &&
          !anyLeading(i.colour, rule.colours),
      );
  }
}

export function checkOutfit(rules: Rule[], items: OutfitItem[]): Violation[] {
  return rules.flatMap((rule) => {
    const bad = breaking(rule, items);
    return bad.length
      ? [{ ruleId: rule.id, items: bad.map((i) => i.name) }]
      : [];
  });
}
