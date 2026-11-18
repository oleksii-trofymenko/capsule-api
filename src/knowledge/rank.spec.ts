import { rank } from './rank.js';

const NOW = new Date('2026-11-17T00:00:00Z');

describe('rank', () => {
  it('puts the newer passage first when two are equally relevant', () => {
    const ranked = rank(
      [
        { id: 'old', similarity: 0.8, publishedOn: '2022-03-01' },
        { id: 'new', similarity: 0.8, publishedOn: '2026-09-01' },
      ],
      NOW,
    );
    expect(ranked.map((p) => p.id)).toEqual(['new', 'old']);
  });

  it('keeps a clearly more relevant older passage ahead of a slightly newer one', () => {
    const ranked = rank(
      [
        { id: 'newer', similarity: 0.6, publishedOn: '2026-10-01' },
        { id: 'relevant', similarity: 0.9, publishedOn: '2022-05-01' },
      ],
      NOW,
    );
    expect(ranked.map((p) => p.id)).toEqual(['relevant', 'newer']);
  });

  it('gives a passage from today the full recency bonus, and none for the future', () => {
    const [today] = rank([{ similarity: 0.5, publishedOn: '2026-11-17' }], NOW);
    expect(today.score).toBeCloseTo(0.55);
    const [future] = rank(
      [{ similarity: 0.5, publishedOn: '2027-01-01' }],
      NOW,
    );
    expect(future.score).toBeCloseTo(0.55);
  });
});
