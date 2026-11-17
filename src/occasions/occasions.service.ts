import { Injectable, Logger } from '@nestjs/common';
import type { Locale } from '../locale.js';
import { checkOutfit, type OutfitItem } from './check-outfit.js';
import { normalise, readLibrary, type Occasion } from './load-occasions.js';

export interface RuleBreak {
  ruleId: string;
  message: string;
  items: string[];
}

/**
 * The occasion library, loaded and validated once at start-up: a broken data
 * file stops the app instead of failing a user's request later.
 */
@Injectable()
export class OccasionsService {
  private readonly occasions: Occasion[];

  constructor() {
    this.occasions = readLibrary();
    new Logger(OccasionsService.name).log(
      `Loaded ${this.occasions.length} occasions`,
    );
  }

  all(): Occasion[] {
    return this.occasions;
  }

  get(id: string): Occasion | undefined {
    return this.occasions.find((o) => o.id === id);
  }

  /**
   * The occasion a phrase refers to: an exact name or alias, else the longest
   * name or alias that appears in it ("my sister's wedding" is a wedding).
   */
  find(text: string, locale: Locale): Occasion | undefined {
    const phrase = normalise(text);
    const names = this.occasions.flatMap((o) =>
      [o.id, o.text[locale].name, ...o.text[locale].aliases].map((n) => ({
        name: normalise(n),
        occasion: o,
      })),
    );
    const exact = names.find((n) => n.name === phrase);
    if (exact) return exact.occasion;
    return names
      .filter((n) => ` ${phrase} `.includes(` ${n.name} `))
      .sort((a, b) => b.name.length - a.name.length)[0]?.occasion;
  }

  /** The occasion's rules this outfit breaks, explained in the given locale. */
  check(occasionId: string, items: OutfitItem[], locale: Locale): RuleBreak[] {
    const occasion = this.get(occasionId);
    if (!occasion) throw new Error(`Unknown occasion "${occasionId}"`);
    return checkOutfit(occasion.rules, items).map((v) => ({
      ...v,
      message: occasion.text[locale].rules[v.ruleId],
    }));
  }
}
