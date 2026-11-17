import type { CATEGORIES, FORMALITIES } from '../db/schema.js';
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

/** A whole word, or that word with a plural ending: "trainer" matches "Trainers" but not "trainerish". */
export function mentions(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${escaped}(s|es)?([^a-z]|$)`, 'i').test(text);
}

const anyOf = (text: string, list: string[]) =>
  list.some((word) => mentions(text, word));

function breaking(rule: Rule, items: OutfitItem[]): OutfitItem[] {
  switch (rule.type) {
    case 'minFormality':
      return items.filter((i) => RANK[i.formality] < RANK[rule.level]);
    case 'maxFormality':
      return items.filter((i) => RANK[i.formality] > RANK[rule.level]);
    case 'forbidItems':
      return items.filter((i) => anyOf(i.name, rule.words));
    case 'forbidMainColour': {
      const main = MAIN_COLOUR_FROM.map((c) =>
        items.find((i) => i.category === c),
      ).find((i) => i !== undefined);
      return main && anyOf(main.colour, rule.colours) ? [main] : [];
    }
    case 'onlyColours':
      return items.filter(
        (i) =>
          rule.categories.includes(i.category) &&
          !anyOf(i.colour, rule.colours),
      );
  }
}

/** Every rule of the occasion that the outfit breaks. Enforced here, not by the prompt. */
export function checkOutfit(rules: Rule[], items: OutfitItem[]): Violation[] {
  return rules.flatMap((rule) => {
    const bad = breaking(rule, items);
    return bad.length
      ? [{ ruleId: rule.id, items: bad.map((i) => i.name) }]
      : [];
  });
}
