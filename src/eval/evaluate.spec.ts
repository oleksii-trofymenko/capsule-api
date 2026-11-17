import {
  runEval,
  summarise,
  type ScenarioResult,
  type Subject,
} from './evaluate.js';
import type { Judge, Verdict } from './judge.js';
import { evalScenarios, type EvalScenario } from './scenarios.js';

const verdict = (v: Partial<Verdict> = {}): Verdict => ({
  ownedOnly: true,
  followsRules: true,
  tone: 5,
  wearability: 5,
  reason: 'fine',
  ...v,
});
const result = (
  r: Partial<ScenarioResult> & Pick<ScenarioResult, 'verdict'>,
): ScenarioResult => ({
  id: 'x',
  transcript: { answer: 'ok', tools: [] },
  ms: 1,
  checks: [{ name: 'answered', pass: true }],
  ...r,
});

describe('summarise', () => {
  it('scores a perfect run 100', () => {
    expect(summarise([result({ verdict: verdict() })])).toMatchObject({
      rules: 100,
      tone: 100,
      wearability: 100,
      score: 100,
      judgeFailures: 0,
    });
  });

  it('scales grades from 1..5 to 0..100 and skips wearability when no outfit was given', () => {
    const summary = summarise([
      result({ verdict: verdict({ tone: 3, wearability: 1 }) }),
      result({ verdict: verdict({ tone: 5, wearability: null }) }),
    ]);
    expect(summary.tone).toBe(75);
    expect(summary.wearability).toBe(0);
  });

  it('counts code checks and both judge rule verdicts as rule checks', () => {
    const summary = summarise([
      result({
        checks: [
          { name: 'answered', pass: true },
          { name: 'calls search_wardrobe', pass: false },
        ],
        verdict: verdict({ followsRules: false }),
      }),
    ]);
    expect(summary.rules).toBe(50);
  });

  it('fails both judge rule checks when the judge gave no verdict', () => {
    const summary = summarise([result({ verdict: null })]);
    expect(summary.rules).toBeCloseTo(33.3);
    expect(summary.judgeFailures).toBe(1);
  });
});

describe('runEval', () => {
  it('sends each conversation to the subject, then checks and judges the reply', async () => {
    const scenarios: EvalScenario[] = [
      {
        id: 'a',
        messages: [{ role: 'user', content: 'Shoes?' }],
        expect: 'lists shoes',
        checks: { tools: ['search_wardrobe'] },
      },
    ];
    const subject = vi.fn<Subject>(async () => ({
      answer: 'Brogues.',
      tools: ['search_wardrobe'],
    }));
    const judge = vi.fn<Judge>(async () => verdict());
    const seen: string[] = [];

    const results = await runEval(scenarios, subject, judge, (r) =>
      seen.push(r.id),
    );

    expect(subject).toHaveBeenCalledWith(scenarios[0].messages);
    expect(judge).toHaveBeenCalledWith(scenarios[0], {
      answer: 'Brogues.',
      tools: ['search_wardrobe'],
    });
    expect(results[0].checks.every((c) => c.pass)).toBe(true);
    expect(seen).toEqual(['a']);
  });

  it('fails an empty reply without asking the judge', async () => {
    const scenarios: EvalScenario[] = [
      { id: 'a', messages: [{ role: 'user', content: 'Hi' }], expect: 'x' },
    ];
    const judge = vi.fn<Judge>(async () => verdict());

    const [r] = await runEval(
      scenarios,
      async () => ({ answer: ' ', tools: [] }),
      judge,
    );

    expect(judge).not.toHaveBeenCalled();
    expect(r.verdict).toMatchObject({ followsRules: false, tone: 1 });
  });
});

describe('evalScenarios', () => {
  it.each(Object.entries(evalScenarios))(
    'has 30 well-formed scenarios for %s',
    (_, scenarios) => {
      expect(scenarios).toHaveLength(30);
      expect(new Set(scenarios.map((s) => s.id)).size).toBe(30);
      for (const s of scenarios) {
        expect(s.messages.at(-1)?.role, s.id).toBe('user');
        const patterns = [
          ...(s.checks?.mentions ?? []),
          ...(s.checks?.avoid ?? []),
        ];
        // A global pattern keeps state between test() calls and gives wrong results.
        for (const p of patterns) expect(p.global, s.id).toBe(false);
      }
    },
  );
});
