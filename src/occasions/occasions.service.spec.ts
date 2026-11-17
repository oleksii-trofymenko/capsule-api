import type { OutfitItem } from './check-outfit.js';
import { buildLibrary } from './load-occasions.js';
import { OccasionsService } from './occasions.service.js';

// A small library built in memory: unit tests do no I/O.
const occasions = new OccasionsService(
  buildLibrary(
    {
      occasions: [
        {
          id: 'wedding-guest',
          formality: 'formal',
          rules: [
            { id: 'no-trainers', type: 'forbidItems', words: ['trainer'] },
          ],
        },
        { id: 'black-tie', formality: 'formal', rules: [] },
      ],
    },
    {
      en: {
        'wedding-guest': {
          name: 'Wedding guest',
          aliases: ['wedding'],
          guidance: 'Tailored.',
          rules: { 'no-trainers': 'No trainers.' },
        },
        'black-tie': {
          name: 'Black tie',
          aliases: ['black tie gala'],
          guidance: 'Most formal.',
          rules: {},
        },
      },
    },
  ),
);

const trainers: OutfitItem = {
  name: 'White leather trainers',
  category: 'shoes',
  colour: 'white',
  formality: 'casual',
};

describe('OccasionsService.find', () => {
  it.each([
    ['Wedding guest', 'wedding-guest'],
    ['wedding', 'wedding-guest'],
    ["my sister's wedding next Saturday", 'wedding-guest'],
    ['BLACK-TIE gala', 'black-tie'],
    ['What should I wear to a wedding?', 'wedding-guest'],
    ['Wedding, next week.', 'wedding-guest'],
  ])('finds %s', (phrase, id) => {
    expect(occasions.find(phrase, 'en')?.id).toBe(id);
  });

  it('finds nothing for an occasion it does not know', () => {
    expect(occasions.find('moon landing', 'en')).toBeUndefined();
  });
});

describe('OccasionsService.check', () => {
  it('returns each broken rule with its message in the locale', () => {
    expect(occasions.check('wedding-guest', [trainers], 'en')).toEqual([
      {
        ruleId: 'no-trainers',
        items: ['White leather trainers'],
        message: 'No trainers.',
      },
    ]);
  });
});
