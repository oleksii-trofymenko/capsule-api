import type {
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
  colourTemperature: {
    question: string;
    options: Labels<typeof COLOUR_TEMPERATURES>;
  };
  colourContrast: {
    question: string;
    options: Labels<typeof COLOUR_CONTRASTS>;
  };
  height: { question: string; options: Labels<typeof HEIGHTS> };
  frame: {
    question: string;
    hint: string;
    options: Labels<typeof FRAME_NOTES>;
  };
  playUp: { question: string; hint: string; options: Labels<typeof PLAY_UP> };
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
    colourTemperature: {
      question: 'Which colours suit your face better?',
      options: {
        warm: 'Warm: gold jewellery, golden or peachy tones',
        cool: 'Cool: silver jewellery, pink or rosy tones',
        neutral: 'Both suit me about the same',
        skip: 'Not sure',
      },
    },
    colourContrast: {
      question: 'How much contrast is there between your hair, skin and eyes?',
      options: {
        high: 'Strong, for example dark hair with light skin',
        medium: 'Somewhere in between',
        low: 'Soft: they are close in tone',
        skip: 'Not sure',
      },
    },
    height: {
      question: 'How would you describe your height?',
      options: {
        petite: 'Petite',
        average: 'Average',
        tall: 'Tall',
        skip: 'Rather not say',
      },
    },
    frame: {
      question: 'Anything about your frame outfits should work with?',
      hint: 'Optional. Pick up to three, or leave empty.',
      options: {
        'longer-torso': 'Longer torso, shorter legs',
        'longer-legs': 'Shorter torso, longer legs',
        'broader-shoulders': 'Shoulders wider than hips',
        'fuller-hips': 'Hips wider than shoulders',
        'defined-waist': 'Defined waist',
        'straight-frame': 'Straight up and down',
      },
    },
    playUp: {
      question: 'What would you like outfits to show off?',
      hint: 'Optional. Pick up to two, or leave empty.',
      options: {
        waist: 'Waist',
        legs: 'Legs',
        shoulders: 'Shoulders',
        neckline: 'Neck and collarbones',
        arms: 'Arms',
      },
    },
  },
};
