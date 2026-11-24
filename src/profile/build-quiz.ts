import {
  COLOUR_CONTRASTS,
  COLOUR_FAMILIES,
  COLOUR_TEMPERATURES,
  FITS,
  FRAME_NOTES,
  HEIGHTS,
  LIFESTYLES,
  NEVER_WEAR,
  PLAY_UP,
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
        id: 'colourTemperature',
        type: 'single',
        question: t.colourTemperature.question,
        options: options(COLOUR_TEMPERATURES, t.colourTemperature.options),
      },
      {
        id: 'colourContrast',
        type: 'single',
        question: t.colourContrast.question,
        options: options(COLOUR_CONTRASTS, t.colourContrast.options),
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
      {
        id: 'height',
        type: 'single',
        question: t.height.question,
        options: options(HEIGHTS, t.height.options),
      },
      {
        id: 'frame',
        type: 'multi',
        question: t.frame.question,
        hint: t.frame.hint,
        max: 3,
        options: options(FRAME_NOTES, t.frame.options),
      },
      {
        id: 'playUp',
        type: 'multi',
        question: t.playUp.question,
        hint: t.playUp.hint,
        max: 2,
        options: options(PLAY_UP, t.playUp.options),
      },
    ],
  };
}
