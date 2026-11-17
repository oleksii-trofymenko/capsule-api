import { buildJudgeMessages, verdictSchema } from './judge.js';
import { judgePrompts } from './judge-prompt.js';
import type { EvalScenario } from './scenarios.js';

const scenario: EvalScenario = {
  id: 'feedback',
  messages: [
    { role: 'user', content: 'Something smart?' },
    { role: 'assistant', content: 'Navy wool blazer.' },
    { role: 'user', content: 'Too stiff.' },
  ],
  expect: 'Swaps the blazer for a softer layer.',
};

describe('buildJudgeMessages', () => {
  it('gives the judge its instructions, the owned items, the expectation, the conversation and the reply', () => {
    const [system, human] = buildJudgeMessages(
      'en',
      ['Navy wool blazer', 'Navy merino crew-neck jumper'],
      scenario,
      { answer: 'Try the jumper.', tools: [] },
    );
    expect(system.text).toBe(judgePrompts.en);
    expect(human.text).toContain('- Navy merino crew-neck jumper');
    expect(human.text).toContain('Swaps the blazer for a softer layer.');
    expect(human.text).toContain(
      'Person: Something smart?\nCapsule: Navy wool blazer.\nPerson: Too stiff.',
    );
    expect(human.text).toContain('Reply to grade:\nTry the jumper.');
  });

  it('tells the judge when there was no reply at all', () => {
    const [, human] = buildJudgeMessages('en', [], scenario, {
      answer: '',
      tools: [],
    });
    expect(human.text).toContain('Reply to grade:\n(no reply)');
  });
});

describe('verdictSchema', () => {
  it('rejects grades outside 1 to 5', () => {
    const base = {
      ownedOnly: true,
      followsRules: true,
      wearability: null,
      reason: 'ok',
    };
    expect(verdictSchema.safeParse({ ...base, tone: 6 }).success).toBe(false);
    expect(verdictSchema.safeParse({ ...base, tone: 4 }).success).toBe(true);
  });
});
