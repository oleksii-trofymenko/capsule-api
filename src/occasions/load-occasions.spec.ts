import { buildLibrary, readLibrary } from './load-occasions.js';

const structure = {
  occasions: [
    {
      id: 'wedding-guest',
      formality: 'formal',
      rules: [{ id: 'formal', type: 'minFormality', level: 'formal' }],
    },
    { id: 'weekend', formality: 'casual', rules: [] },
  ],
};
const text = {
  'wedding-guest': {
    name: 'Wedding guest',
    aliases: ['wedding'],
    guidance: 'Tailored.',
    rules: { formal: 'Wear formal pieces.' },
  },
  weekend: { name: 'Weekend', aliases: [], guidance: 'Comfy.', rules: {} },
};

describe('readLibrary', () => {
  it('loads the twelve occasions in data/occasions with text for every locale', () => {
    const library = readLibrary();
    expect(library).toHaveLength(12);
    for (const o of library) {
      expect(o.text.en.name, o.id).not.toBe('');
      for (const r of o.rules) expect(o.text.en.rules[r.id], r.id).toBeTruthy();
    }
  });
});

describe('buildLibrary', () => {
  it('joins structure and text', () => {
    const [wedding] = buildLibrary(structure, { en: text });
    expect(wedding).toMatchObject({
      id: 'wedding-guest',
      text: {
        en: { name: 'Wedding guest', rules: { formal: 'Wear formal pieces.' } },
      },
    });
  });

  it.each([
    [
      'an unknown rule type',
      {
        occasions: [
          { id: 'x', formality: 'smart', rules: [{ id: 'r', type: 'vibes' }] },
        ],
      },
      text,
      /occasions\.json is invalid/,
    ],
    [
      'an occasion with no text',
      structure,
      { 'wedding-guest': text['wedding-guest'] },
      /en: no text for "weekend"/,
    ],
    [
      'a rule with no message',
      structure,
      { ...text, 'wedding-guest': { ...text['wedding-guest'], rules: {} } },
      /no message for rule "wedding-guest\/formal"/,
    ],
    [
      'a message for a rule that does not exist',
      structure,
      { ...text, weekend: { ...text.weekend, rules: { comfy: 'Be comfy.' } } },
      /message for unknown rule "weekend\/comfy"/,
    ],
    [
      'text for an occasion that does not exist',
      structure,
      { ...text, gala: text.weekend },
      /text for unknown occasion "gala"/,
    ],
    [
      'an alias that names two occasions',
      structure,
      { ...text, weekend: { ...text.weekend, aliases: ['Wedding'] } },
      /"wedding" names both "wedding-guest" and "weekend"/,
    ],
    [
      'the same occasion twice',
      { occasions: [...structure.occasions, structure.occasions[1]] },
      text,
      /occasion "weekend" is defined twice/,
    ],
  ])('refuses %s', (_name, s, t, error) => {
    expect(() => buildLibrary(s, { en: t })).toThrow(error);
  });
});
