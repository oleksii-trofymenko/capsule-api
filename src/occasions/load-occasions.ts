import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FORMALITIES } from '../db/schema.js';
import { LOCALES, type Locale } from '../locale.js';
import {
  occasionFileSchema,
  occasionTextFileSchema,
  type Rule,
} from './occasion.schemas.js';

export interface Occasion {
  id: string;
  formality: (typeof FORMALITIES)[number];
  rules: Rule[];
  text: Record<
    Locale,
    {
      name: string;
      aliases: string[];
      guidance: string;
      rules: Record<string, string>;
    }
  >;
}

/** Lower case, single spaces, dashes as spaces: "Black-Tie  Gala" is "black tie gala". */
export const normalise = (s: string) =>
  s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Joins the structure file with every locale's text and checks they agree.
 * Throws one error listing every problem, so a bad edit stops the app at start-up.
 */
export function buildLibrary(
  structure: unknown,
  texts: Record<Locale, unknown>,
): Occasion[] {
  const problems: string[] = [];
  const parsed = occasionFileSchema.safeParse(structure);
  if (!parsed.success) {
    throw new Error(
      `occasions.json is invalid:\n${parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`,
    );
  }
  const occasions = parsed.data.occasions;

  const localeTexts = {} as Record<
    Locale,
    ReturnType<typeof occasionTextFileSchema.parse>
  >;
  for (const locale of LOCALES) {
    const result = occasionTextFileSchema.safeParse(texts[locale]);
    if (!result.success) {
      problems.push(`${locale}.json is invalid`);
      continue;
    }
    localeTexts[locale] = result.data;
  }

  const ids = occasions.map((o) => o.id);
  for (const dup of ids.filter((id, i) => ids.indexOf(id) !== i)) {
    problems.push(`occasion "${dup}" is defined twice`);
  }
  for (const o of occasions) {
    const ruleIds = o.rules.map((r) => r.id);
    if (new Set(ruleIds).size !== ruleIds.length) {
      problems.push(`${o.id}: rule ids repeat`);
    }
  }

  for (const locale of LOCALES) {
    const text = localeTexts[locale];
    if (!text) continue;
    const owner = new Map<string, string>();
    for (const o of occasions) {
      const t = text[o.id];
      if (!t) {
        problems.push(`${locale}: no text for "${o.id}"`);
        continue;
      }
      for (const r of o.rules) {
        if (!t.rules[r.id]) {
          problems.push(`${locale}: no message for rule "${o.id}/${r.id}"`);
        }
      }
      for (const extra of Object.keys(t.rules).filter(
        (k) => !o.rules.some((r) => r.id === k),
      )) {
        problems.push(`${locale}: message for unknown rule "${o.id}/${extra}"`);
      }
      for (const phrase of [o.id, t.name, ...t.aliases].map(normalise)) {
        const other = owner.get(phrase);
        if (other && other !== o.id) {
          problems.push(
            `${locale}: "${phrase}" names both "${other}" and "${o.id}"`,
          );
        }
        owner.set(phrase, o.id);
      }
    }
    for (const extra of Object.keys(text).filter((k) => !ids.includes(k))) {
      problems.push(`${locale}: text for unknown occasion "${extra}"`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Occasion library is invalid:\n  ${problems.join('\n  ')}`);
  }
  return occasions.map((o) => ({
    ...o,
    text: Object.fromEntries(
      LOCALES.map((l) => [l, localeTexts[l][o.id]]),
    ) as Occasion['text'],
  }));
}

/** Reads data/occasions from disk. The folder sits two levels above both src/occasions and dist/occasions. */
export function readLibrary(
  dir = join(import.meta.dirname, '..', '..', 'data', 'occasions'),
): Occasion[] {
  const read = (file: string): unknown =>
    JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const texts = Object.fromEntries(
    LOCALES.map((l) => [l, read(`${l}.json`)]),
  ) as Record<Locale, unknown>;
  return buildLibrary(read('occasions.json'), texts);
}
