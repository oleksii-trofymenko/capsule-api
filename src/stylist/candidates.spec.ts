import type { Rule } from '../occasions/occasion.schemas.js';
import { describeItem, filterCandidates, seasonOf } from './candidates.js';
import type { StylistItem } from './context.js';

const item = (
  id: string,
  name: string,
  category: StylistItem['category'],
  colour: string,
  formality: StylistItem['formality'],
): StylistItem => ({
  id,
  name,
  category,
  colour,
  formality,
  seasons: ['autumn', 'winter'],
});

const shirt = item('w01', 'White cotton shirt', 'top', 'white', 'smart');
const jumper = item('w02', 'Grey turtleneck jumper', 'top', 'grey', 'smart');
const trainers = item(
  'w11',
  'White leather trainers',
  'shoes',
  'white',
  'casual',
);
const pumps = item('w15', 'Black suede pumps', 'shoes', 'black', 'formal');

describe('seasonOf', () => {
  it.each([
    ['2026-01-15', 'winter'],
    ['2026-04-01', 'spring'],
    ['2026-07-31', 'summer'],
    ['2026-11-17', 'autumn'],
    ['2026-12-01', 'winter'],
  ])('%s is %s', (date, season) => {
    expect(seasonOf(new Date(date))).toBe(season);
  });
});

describe('filterCandidates', () => {
  const wardrobe = [shirt, jumper, trainers, pumps];

  it('keeps everything when there is no occasion and no dislikes', () => {
    expect(filterCandidates(wardrobe, [], [])).toEqual(wardrobe);
  });

  it("removes items the occasion's rules forbid, item by item", () => {
    const rules: Rule[] = [
      { id: 'smart', type: 'minFormality', level: 'smart' },
      { id: 'no-trainers', type: 'forbidItems', words: ['trainer'] },
    ];
    expect(filterCandidates(wardrobe, rules, [])).toEqual([
      shirt,
      jumper,
      pumps,
    ]);
  });

  it('leaves the main-colour rule to the check after composing', () => {
    const rules: Rule[] = [
      { id: 'no-white', type: 'forbidMainColour', colours: ['white'] },
    ];
    expect(filterCandidates(wardrobe, rules, [])).toEqual(wardrobe);
  });

  it('removes what the person said they never wear', () => {
    expect(filterCandidates(wardrobe, [], ['high-necklines', 'heels'])).toEqual(
      [shirt, trainers],
    );
  });
});

describe('describeItem', () => {
  it('describes an item for a prompt without its id', () => {
    const text = describeItem(shirt);
    expect(text).toBe('White cotton shirt (top, white, smart; autumn, winter)');
    expect(text).not.toContain('w01');
  });
});
