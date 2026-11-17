import { runChecks, type Transcript } from './checks.js';
import type { EvalScenario } from './scenarios.js';

const scenario = (checks: EvalScenario['checks'] = {}): EvalScenario => ({
  id: 'test',
  messages: [{ role: 'user', content: 'Hi' }],
  expect: 'anything',
  checks,
});
const reply = (answer: string, tools: string[] = []): Transcript => ({
  answer,
  tools,
});
const failed = (s: EvalScenario, t: Transcript) =>
  runChecks(s, t)
    .filter((c) => !c.pass)
    .map((c) => c.name);

describe('runChecks', () => {
  it('passes a plain, complete reply with no scenario checks', () => {
    expect(failed(scenario(), reply('The navy jumper with chinos.'))).toEqual(
      [],
    );
  });

  it('fails an empty reply, leaked reasoning and internal ids on every scenario', () => {
    expect(failed(scenario(), reply('  '))).toEqual(['answered']);
    expect(failed(scenario(), reply('Fine.<channel|>more'))).toEqual([
      'no leaked reasoning',
    ]);
    expect(
      failed(scenario(), reply('The user wants a smart look. Try this.')),
    ).toEqual(['no leaked reasoning']);
    expect(failed(scenario(), reply('Your waxed jacket (w09).'))).toEqual([
      'no internal ids',
    ]);
  });

  it('requires every listed tool to have been called', () => {
    const s = scenario({ tools: ['get_dress_code', 'search_wardrobe'] });
    expect(failed(s, reply('ok', ['search_wardrobe']))).toEqual([
      'calls get_dress_code',
    ]);
    expect(
      failed(s, reply('ok', ['get_dress_code', 'search_wardrobe'])),
    ).toEqual([]);
  });

  it('checks patterns that must and must not appear', () => {
    const s = scenario({ mentions: [/blazer/i], avoid: [/hide/i] });
    expect(failed(s, reply('The Navy wool blazer.'))).toEqual([]);
    expect(failed(s, reply('Something to hide it.'))).toEqual([
      'mentions blazer',
      'avoids hide',
    ]);
  });

  it('requires a question when the scenario asks for one', () => {
    const s = scenario({ asks: true });
    expect(failed(s, reply('Where are you going?'))).toEqual([]);
    expect(failed(s, reply('Wear jeans.'))).toEqual(['asks a question']);
  });

  it('fails any price above the budget, in that currency only', () => {
    const s = scenario({ budget: { currency: '£', max: 50 } });
    expect(
      failed(s, reply('Swim shorts around £25 and sandals £ 20.')),
    ).toEqual([]);
    expect(failed(s, reply('A good pair is about £60.'))).toEqual([
      'stays within £50',
    ]);
    expect(failed(s, reply('About $80 in the US.'))).toEqual([]);
  });
});
