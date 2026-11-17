import {
  COLOUR_FAMILIES,
  FITS,
  LIFESTYLES,
  NEVER_WEAR,
  SIZE_SYSTEMS,
  STYLE_DIRECTIONS,
} from '../db/schema.js';
import type { Locale } from '../locale.js';
import type { Quiz } from './profile.schemas.js';
import { quizText } from './quiz.js';

/** Options in the schema's order, with this locale's labels. */
const options = <T extends readonly string[]>(
  codes: T,
  labels: Record<T[number], string>,
) => codes.map((id: T[number]) => ({ id, label: labels[id] }));

/** The quiz as a client renders it: question order, types and limits come from here. */
export function buildQuiz(locale: Locale): Quiz {
  const t = quizText[locale];
  const colours = options(COLOUR_FAMILIES, t.favouriteColours.options);
  return {
    title: t.title,
    intro: t.intro,
    questions: [
      {
        id: 'sizes',
        type: 'sizes',
        question: t.sizes.question,
        hint: t.sizes.hint,
        parts: options(['top', 'bottom', 'shoes'] as const, t.sizes.parts),
        systems: options(SIZE_SYSTEMS, t.sizes.systems),
      },
      {
        id: 'fit',
        type: 'single',
        question: t.fit.question,
        options: options(FITS, t.fit.options),
      },
      {
        id: 'directions',
        type: 'multi',
        question: t.directions.question,
        hint: t.directions.hint,
        max: 3,
        options: options(STYLE_DIRECTIONS, t.directions.options),
      },
      {
        id: 'favouriteColours',
        type: 'multi',
        question: t.favouriteColours.question,
        hint: null,
        max: COLOUR_FAMILIES.length,
        options: colours,
      },
      {
        id: 'avoidColours',
        type: 'multi',
        question: t.avoidColours.question,
        hint: t.avoidColours.hint,
        max: COLOUR_FAMILIES.length,
        options: colours,
      },
      {
        id: 'lifestyle',
        type: 'single',
        question: t.lifestyle.question,
        options: options(LIFESTYLES, t.lifestyle.options),
      },
      {
        id: 'neverWear',
        type: 'multi',
        question: t.neverWear.question,
        hint: t.neverWear.hint,
        max: NEVER_WEAR.length,
        options: options(NEVER_WEAR, t.neverWear.options),
      },
    ],
  };
}
