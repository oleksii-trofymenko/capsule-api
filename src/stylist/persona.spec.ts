import { stylistExamples } from './examples.js';
import { stylistPersona, type Locale } from './persona.js';

const locales = Object.keys(stylistPersona) as Locale[];

describe.each(locales)('stylist data for %s', (locale) => {
  it('keeps the persona short enough for a small local model', () => {
    // Roughly 500 tokens. A longer prompt crowds out wardrobe and tool context.
    expect(stylistPersona[locale].length).toBeLessThanOrEqual(2000);
  });

  it('has ten examples with unique ids', () => {
    const ids = stylistExamples[locale].map((e) => e.id);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('writes each example as alternating turns from the user to the stylist', () => {
    for (const example of stylistExamples[locale]) {
      const roles = example.turns.map((t) => t.role);
      expect(roles.length % 2, example.id).toBe(0);
      roles.forEach((role, i) =>
        expect(role, example.id).toBe(i % 2 === 0 ? 'user' : 'stylist'),
      );
    }
  });
});
