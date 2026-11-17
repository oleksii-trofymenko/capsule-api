import type { OutfitItem } from '../../src/occasions/check-outfit.js';
import { readLibrary } from '../../src/occasions/load-occasions.js';
import { OccasionsService } from '../../src/occasions/occasions.service.js';

// The real data/occasions files, as the app loads them at start-up.
const library = readLibrary();
const occasions = new OccasionsService(library);

describe('data/occasions', () => {
  it('holds twelve occasions with text for every rule', () => {
    expect(library).toHaveLength(12);
    for (const o of library) {
      expect(o.text.en.name, o.id).not.toBe('');
      for (const r of o.rules) expect(o.text.en.rules[r.id], r.id).toBeTruthy();
    }
  });
});

const item = (
  name: string,
  category: OutfitItem['category'],
  colour: string,
  formality: OutfitItem['formality'],
): OutfitItem => ({ name, category, colour, formality });

// Formality as the playground's sample wardrobe tags these pieces.
const blazer = item('Navy wool blazer', 'outerwear', 'navy', 'formal');
const shirt = item('White cotton shirt', 'top', 'white', 'smart');
const trousers = item('Charcoal wool trousers', 'bottom', 'charcoal', 'formal');
const brogues = item('Black leather brogues', 'shoes', 'black', 'smart');
const tie = item('Burgundy knitted tie', 'accessory', 'burgundy', 'smart');
const trainers = item('White leather trainers', 'shoes', 'white', 'casual');
const overcoat = item('Camel wool overcoat', 'outerwear', 'camel', 'smart');

/** The rule breaks for a known occasion. */
function breaksFor(id: string, items: OutfitItem[], locale: 'en') {
  const result = occasions.check(id, items, locale);
  if (!result.found) throw new Error(`no occasion ${id}`);
  return result.breaks;
}

describe('OccasionsService.find', () => {
  it.each([
    ['Wedding guest', 'wedding-guest'],
    ['wedding', 'wedding-guest'],
    ['BLACK-TIE gala', 'black-tie'],
    ["my sister's wedding next Saturday", 'wedding-guest'],
    ['a black tie dinner at the museum', 'black-tie'],
    ['going on a hike', 'country-walk'],
  ])('finds %s', (phrase, id) => {
    expect(occasions.find(phrase, 'en')?.id).toBe(id);
  });

  it('finds nothing for an occasion it does not know', () => {
    expect(occasions.find('moon landing', 'en')).toBeUndefined();
  });

  it.each([
    ['a casual date', 'first-date'],
    ['Funeral, next week', 'funeral'],
    ['Christmas holiday party', undefined],
    ['What should I wear to work out at the gym?', undefined],
    ['What should I wear when I wake up?', undefined],
    ['What do I wear for my walk to work?', undefined],
  ])('does not let a generic word pick the occasion: %s', (phrase, id) => {
    expect(occasions.find(phrase, 'en')?.id).toBe(id);
  });
});

describe('OccasionsService.check', () => {
  it('passes a classic wedding outfit, white shirt under a navy blazer included', () => {
    expect(
      breaksFor('wedding-guest', [blazer, shirt, trousers, brogues], 'en'),
    ).toEqual([]);
  });

  it("passes the stylist's own wedding outfit, as the sample wardrobe tags it", () => {
    expect(
      breaksFor('wedding-guest', [blazer, shirt, trousers, brogues, tie], 'en'),
    ).toEqual([]);
  });

  it('asks black tie for formal tailoring, not a formal shirt and shoes', () => {
    expect(
      breaksFor('black-tie', [blazer, shirt, trousers, brogues], 'en'),
    ).toEqual([]);
    const chinos = item('Navy chinos', 'bottom', 'navy', 'smart');
    expect(
      breaksFor('black-tie', [blazer, shirt, chinos, brogues], 'en').map(
        (b) => [b.ruleId, b.items],
      ),
    ).toEqual([
      ['formal', ['Navy chinos']],
      ['no-casual-pieces', ['Navy chinos']],
    ]);
  });

  it('explains why trainers do not work at a wedding', () => {
    expect(
      breaksFor('wedding-guest', [blazer, shirt, trousers, trainers], 'en'),
    ).toEqual([
      {
        ruleId: 'smart',
        items: ['White leather trainers'],
        message: 'Keep every piece smart or formal.',
      },
      {
        ruleId: 'no-casual-pieces',
        items: ['White leather trainers'],
        message: 'No jeans, trainers, hoodies or t-shirts.',
      },
    ]);
  });

  it('keeps a funeral dark, but allows a white shirt', () => {
    expect(
      breaksFor('funeral', [blazer, shirt, trousers, brogues], 'en'),
    ).toEqual([]);
    expect(
      breaksFor('funeral', [overcoat, shirt, trousers, brogues], 'en').map(
        (b) => b.ruleId,
      ),
    ).toEqual(['dark-colours']);
  });

  it('rules out boots for the beach, as its message says', () => {
    const boots = item('Black ankle boots', 'shoes', 'black', 'casual');
    expect(
      breaksFor('beach-holiday', [boots], 'en').map((b) => b.ruleId),
    ).toEqual(['no-heavy-pieces']);
  });

  it('rules out a wool overcoat for the beach', () => {
    expect(
      breaksFor('beach-holiday', [overcoat], 'en').map((b) => b.ruleId),
    ).toEqual(['no-heavy-pieces']);
  });

  it('refuses an occasion id it does not know', () => {
    expect(occasions.check('moon-landing', [], 'en')).toEqual({
      found: false,
    });
  });
});
