import { checkOutfit, mentions, type OutfitItem } from './check-outfit.js';
import type { Rule } from './occasion.schemas.js';

const item = (
  name: string,
  category: OutfitItem['category'],
  colour: string,
  formality: OutfitItem['formality'] = 'smart',
): OutfitItem => ({ name, category, colour, formality });

const shirt = item('White cotton shirt', 'top', 'white');
const blazer = item('Navy wool blazer', 'outerwear', 'navy', 'formal');
const trousers = item('Charcoal wool trousers', 'bottom', 'charcoal', 'formal');
const trainers = item('White leather trainers', 'shoes', 'white', 'casual');

describe('mentions', () => {
  it.each([
    ['White leather trainers', 'trainer', true],
    ['Black Chelsea boots', 'boot', true],
    ['Bootcut jeans', 'boot', false],
    ['Wheel print scarf', 'heel', false],
    ['Off-white linen shirt', 'white', true],
    ['Grey marl t-shirt', 't-shirt', true],
    ['Leather flip-flops', 'flip-flop', true],
    ['TRAINERS', 'trainer', true],
    ['White T shirt', 't-shirt', true],
    ['Grey tshirt', 't-shirt', true],
    ['Black flip flops', 'flip-flop', true],
  ])('%s mentions %s: %s', (text, word, expected) => {
    expect(mentions(text, word)).toBe(expected);
  });
});

describe('checkOutfit', () => {
  it('flags items below or above a formality level', () => {
    const min: Rule = { id: 'formal', type: 'minFormality', level: 'formal' };
    const max: Rule = { id: 'relaxed', type: 'maxFormality', level: 'smart' };
    expect(checkOutfit([min], [blazer, trousers, shirt])).toEqual([
      { ruleId: 'formal', items: ['White cotton shirt'] },
    ]);
    expect(checkOutfit([max], [blazer, shirt])).toEqual([
      { ruleId: 'relaxed', items: ['Navy wool blazer'] },
    ]);
  });

  it('leaves accessories out of formality rules unless the rule lists them', () => {
    const belt = item('Brown leather belt', 'accessory', 'brown', 'casual');
    const min: Rule = { id: 'formal', type: 'minFormality', level: 'formal' };
    expect(checkOutfit([min], [blazer, trousers, belt])).toEqual([]);
    const scoped: Rule = { ...min, categories: ['bottom', 'outerwear'] };
    expect(checkOutfit([scoped], [blazer, trousers, shirt, trainers])).toEqual(
      [],
    );
    const withBelts: Rule = { ...min, categories: ['accessory'] };
    expect(checkOutfit([withBelts], [belt])).toEqual([
      { ruleId: 'formal', items: ['Brown leather belt'] },
    ]);
  });

  it('flags items whose names contain a forbidden word', () => {
    const rule: Rule = {
      id: 'no-casual',
      type: 'forbidItems',
      words: ['jeans', 'trainer'],
    };
    expect(checkOutfit([rule], [shirt, trousers, trainers])).toEqual([
      { ruleId: 'no-casual', items: ['White leather trainers'] },
    ]);
    expect(checkOutfit([rule], [shirt, trousers])).toEqual([]);
  });

  it('takes the main colour from the dress, else the outer layer, else the top', () => {
    const rule: Rule = {
      id: 'no-white',
      type: 'forbidMainColour',
      colours: ['white', 'ivory'],
    };
    // A white shirt under a navy blazer: navy is the main colour.
    expect(checkOutfit([rule], [shirt, blazer, trousers])).toEqual([]);
    // The same shirt alone is the main colour.
    expect(checkOutfit([rule], [shirt, trousers])).toEqual([
      { ruleId: 'no-white', items: ['White cotton shirt'] },
    ]);
    const twoTone = item('Silk dress', 'dress', 'black and white', 'formal');
    expect(checkOutfit([rule], [twoTone])).toEqual([]);
    const dress = item('Ivory silk dress', 'dress', 'ivory', 'formal');
    expect(checkOutfit([rule], [dress, blazer])).toEqual([
      { ruleId: 'no-white', items: ['Ivory silk dress'] },
    ]);
  });

  it('judges the main colour the same way whatever order the items come in', () => {
    const rule: Rule = {
      id: 'no-white',
      type: 'forbidMainColour',
      colours: ['white'],
    };
    const whiteCoat = item('White trench coat', 'outerwear', 'white');
    const flagged = [{ ruleId: 'no-white', items: ['White trench coat'] }];
    expect(checkOutfit([rule], [blazer, whiteCoat, shirt])).toEqual(flagged);
    expect(checkOutfit([rule], [whiteCoat, blazer, shirt])).toEqual(flagged);
  });

  it('reads a colour by its leading words', () => {
    const rule: Rule = {
      id: 'dark',
      type: 'onlyColours',
      colours: ['charcoal'],
      categories: ['bottom'],
    };
    const lead = item('Wool trousers', 'bottom', 'charcoal and pink');
    const tail = item('Silk trousers', 'bottom', 'pink and charcoal');
    expect(checkOutfit([rule], [lead, tail])).toEqual([
      { ruleId: 'dark', items: ['Silk trousers'] },
    ]);
  });

  it('limits colours only in the listed categories', () => {
    const rule: Rule = {
      id: 'dark',
      type: 'onlyColours',
      colours: ['black', 'navy', 'charcoal', 'dark'],
      categories: ['bottom', 'outerwear', 'shoes'],
    };
    const brogues = item('Tan brogues', 'shoes', 'tan');
    expect(checkOutfit([rule], [shirt, blazer, trousers])).toEqual([]);
    expect(
      checkOutfit(
        [rule],
        [blazer, item('Dark green chinos', 'bottom', 'dark green'), brogues],
      ),
    ).toEqual([{ ruleId: 'dark', items: ['Tan brogues'] }]);
  });

  it('reports every broken rule, and nothing for an outfit that keeps them all', () => {
    const rules: Rule[] = [
      { id: 'formal', type: 'minFormality', level: 'formal' },
      { id: 'no-casual', type: 'forbidItems', words: ['trainer'] },
    ];
    expect(
      checkOutfit(rules, [blazer, trousers, trainers]).map((v) => v.ruleId),
    ).toEqual(['formal', 'no-casual']);
    expect(checkOutfit([], [trainers])).toEqual([]);
  });
});
