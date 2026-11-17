import { Inject, Injectable, Logger } from '@nestjs/common';
import { LOCALES, type Locale } from '../locale.js';
import { checkOutfit, type OutfitItem } from './check-outfit.js';
import { OCCASION_LIBRARY, type Occasion } from './load-occasions.js';
import { normalise } from './normalise.js';

export interface RuleBreak {
  ruleId: string;
  message: string;
  items: string[];
}

/**
 * The occasion library, loaded and validated once at start-up: a broken data
 * file stops the app instead of failing a user's request later.
 */
export type CheckResult =
  { found: false } | { found: true; breaks: RuleBreak[] };

interface Name {
  name: string;
  occasion: Occasion;
}

@Injectable()
export class OccasionsService {
  /** Every name and alias per locale, normalised once, longest first. */
  private readonly names: Record<Locale, Name[]>;

  constructor(
    @Inject(OCCASION_LIBRARY) private readonly occasions: Occasion[],
  ) {
    const namesFor = (locale: Locale): Name[] =>
      occasions
        .flatMap((occasion) =>
          [
            occasion.id,
            occasion.text[locale].name,
            ...occasion.text[locale].aliases,
          ].map((n) => ({ name: normalise(n), occasion })),
        )
        .sort((a, b) => b.name.length - a.name.length);
    this.names = Object.fromEntries(
      LOCALES.map((l) => [l, namesFor(l)]),
    ) as Record<Locale, Name[]>;
    new Logger(OccasionsService.name).log(
      `Loaded ${occasions.length} occasions`,
    );
  }

  all(): Occasion[] {
    return this.occasions;
  }

  get(id: string): Occasion | undefined {
    return this.occasions.find((o) => o.id === id);
  }

  /** The occasion whose longest name or alias appears in the phrase ("my sister's wedding?" is a wedding). */
  find(text: string, locale: Locale): Occasion | undefined {
    const phrase = ` ${normalise(text)} `;
    return this.names[locale].find((n) => phrase.includes(` ${n.name} `))
      ?.occasion;
  }

  /**
   * The occasion's rules this outfit breaks, explained in the given locale.
   * The id may come from a model, so an unknown one is a result, not an error.
   */
  check(occasionId: string, items: OutfitItem[], locale: Locale): CheckResult {
    const occasion = this.get(occasionId);
    if (!occasion) return { found: false };
    const breaks = checkOutfit(occasion.rules, items).map((v) => ({
      ...v,
      message: occasion.text[locale].rules[v.ruleId],
    }));
    return { found: true, breaks };
  }
}
