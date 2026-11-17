import type {
  COLOUR_FAMILIES,
  FITS,
  LIFESTYLES,
  NEVER_WEAR,
  SIZE_SYSTEMS,
  STYLE_DIRECTIONS,
} from '../db/schema.js';
import type { Locale } from '../locale.js';

type Labels<T extends readonly string[]> = Record<T[number], string>;

export interface QuizText {
  title: string;
  intro: string;
  sizes: {
    question: string;
    hint: string;
    parts: { top: string; bottom: string; shoes: string };
    systems: Labels<typeof SIZE_SYSTEMS>;
  };
  fit: { question: string; options: Labels<typeof FITS> };
  directions: {
    question: string;
    hint: string;
    options: Labels<typeof STYLE_DIRECTIONS>;
  };
  favouriteColours: {
    question: string;
    options: Labels<typeof COLOUR_FAMILIES>;
  };
  avoidColours: { question: string; hint: string };
  lifestyle: { question: string; options: Labels<typeof LIFESTYLES> };
  neverWear: {
    question: string;
    hint: string;
    options: Labels<typeof NEVER_WEAR>;
  };
}

/**
 * The onboarding quiz, keyed by locale. Answer codes are fixed in the schema;
 * only the words change per locale. Kept to about two minutes.
 */
export const quizText: Record<Locale, QuizText> = {
  en: {
    title: 'Your style in two minutes',
    intro:
      'A few quick questions so suggestions fit you from the start. You can change any answer later.',
    sizes: {
      question: 'What sizes do you usually wear?',
      hint: 'Skip any you are not sure of.',
      parts: { top: 'Tops', bottom: 'Bottoms', shoes: 'Shoes' },
      systems: {
        UK: 'UK',
        EU: 'EU',
        US: 'US',
        INT: 'Letter (XS to XXL)',
      },
    },
    fit: {
      question: 'How do you like clothes to fit?',
      options: {
        fitted: 'Close to the body',
        regular: 'Regular',
        relaxed: 'Relaxed and roomy',
      },
    },
    directions: {
      question: 'Which styles feel most like you?',
      hint: 'Pick up to three.',
      options: {
        classic: 'Classic',
        minimal: 'Minimal',
        'smart-casual': 'Smart casual',
        streetwear: 'Streetwear',
        romantic: 'Romantic',
        bohemian: 'Bohemian',
        edgy: 'Edgy',
        sporty: 'Sporty',
        preppy: 'Preppy',
      },
    },
    favouriteColours: {
      question: 'Which colours do you love wearing?',
      options: {
        neutrals: 'Neutrals: black, white, grey, cream',
        'earth-tones': 'Earth tones: brown, camel, olive',
        blues: 'Blues and navy',
        pastels: 'Pastels',
        brights: 'Brights',
        'jewel-tones': 'Jewel tones: emerald, burgundy, sapphire',
      },
    },
    avoidColours: {
      question: 'Any colours you would rather avoid?',
      hint: 'Leave empty if none.',
    },
    lifestyle: {
      question: 'What does most of your week look like?',
      options: {
        office: 'A formal workplace',
        'smart-casual-work': 'A smart-casual workplace',
        casual: 'Mostly casual or at home',
        active: 'Active and outdoors',
        mixed: 'A real mix',
      },
    },
    neverWear: {
      question: 'Anything you never wear?',
      hint: 'Leave empty if none.',
      options: {
        'high-necklines': 'High or tight necklines',
        sleeveless: 'Sleeveless tops',
        'short-hemlines': 'Short hemlines',
        'skinny-fits': 'Skinny fits',
        heels: 'Heels',
        logos: 'Visible logos',
        'bold-patterns': 'Bold patterns',
      },
    },
  },
};
