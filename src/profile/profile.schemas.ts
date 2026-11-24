import { z } from 'zod';
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
  STYLE_DIRECTIONS,
} from '../db/schema.js';
import { feedbackSummarySchema } from '../outfits/outfits.schemas.js';
import { sizeSchema } from '../wardrobe/wardrobe.schemas.js';

const choices = <T extends readonly [string, ...string[]]>(codes: T) =>
  z
    .array(z.enum(codes))
    .max(codes.length)
    .refine((a) => new Set(a).size === a.length, 'choices must not repeat');

export const profileAnswersSchema = z
  .object({
    sizes: z.object({
      top: sizeSchema.nullable(),
      bottom: sizeSchema.nullable(),
      shoes: sizeSchema
        .refine((s) => s.system !== 'INT', 'shoe sizes need UK, EU or US')
        .nullable(),
    }),
    fit: z.enum(FITS),
    directions: choices(STYLE_DIRECTIONS).min(1).max(3),
    favouriteColours: choices(COLOUR_FAMILIES),
    avoidColours: choices(COLOUR_FAMILIES),
    lifestyle: z.enum(LIFESTYLES),
    neverWear: choices(NEVER_WEAR),
    // Optional, with defaults, so clients built before these questions still save.
    colourTemperature: z.enum(COLOUR_TEMPERATURES).default('skip'),
    colourContrast: z.enum(COLOUR_CONTRASTS).default('skip'),
    height: z.enum(HEIGHTS).default('skip'),
    frame: choices(FRAME_NOTES).max(3).default([]),
    playUp: choices(PLAY_UP).max(2).default([]),
  })
  .refine((a) => !a.avoidColours.some((c) => a.favouriteColours.includes(c)), {
    path: ['avoidColours'],
    message: 'a colour cannot be both loved and avoided',
  });

export const profileSchema = z.object({
  profile: profileAnswersSchema
    .and(z.object({ updatedAt: z.iso.datetime() }))
    .nullable()
    .describe('Null until the quiz is answered'),
  feedback: feedbackSummarySchema.describe(
    'Feedback the person gave on suggested outfits',
  ),
});

const option = z.object({ id: z.string(), label: z.string() });

export const quizSchema = z.object({
  title: z.string(),
  intro: z.string(),
  questions: z.array(
    z.discriminatedUnion('type', [
      z.object({
        id: z.literal('sizes'),
        type: z.literal('sizes'),
        question: z.string(),
        hint: z.string(),
        parts: z.array(option),
        systems: z.array(option),
      }),
      z.object({
        id: z.enum([
          'fit',
          'lifestyle',
          'colourTemperature',
          'colourContrast',
          'height',
        ]),
        type: z.literal('single'),
        question: z.string(),
        options: z.array(option),
      }),
      z.object({
        id: z.enum([
          'directions',
          'favouriteColours',
          'avoidColours',
          'neverWear',
          'frame',
          'playUp',
        ]),
        type: z.literal('multi'),
        question: z.string(),
        hint: z.string().nullable(),
        max: z.number().int(),
        options: z.array(option),
      }),
    ]),
  ),
});

export type ProfileAnswers = z.infer<typeof profileAnswersSchema>;
export type Quiz = z.infer<typeof quizSchema>;
