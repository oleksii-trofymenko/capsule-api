import { runChecks, type CheckResult, type Transcript } from './checks.js';
import type { Judge, Verdict } from './judge.js';
import type { EvalScenario } from './scenarios.js';

/** The stylist under test: takes a conversation, returns what it did. */
export type Subject = (
  messages: EvalScenario['messages'],
) => Promise<Transcript>;

export interface ScenarioResult {
  id: string;
  transcript: Transcript;
  ms: number;
  checks: CheckResult[];
  verdict: Verdict | null;
}

export interface EvalSummary {
  scenarios: number;
  /** Share of all rule checks passed, code and judge together, 0 to 100. */
  rules: number;
  /** Mean judged tone, scaled from 1..5 to 0..100. */
  tone: number;
  /** Mean judged wearability over replies that suggest an outfit, 0 to 100. */
  wearability: number;
  /** Mean of the three. The number to compare between runs. */
  score: number;
  judgeFailures: number;
}

/** Code checks plus the judge's two rule verdicts. A failed judge fails both. */
export function ruleResults(result: ScenarioResult): CheckResult[] {
  return [
    ...result.checks,
    { name: 'judge: owned items only', pass: !!result.verdict?.ownedOnly },
    { name: 'judge: follows the rules', pass: !!result.verdict?.followsRules },
  ];
}

const scaled = (grades: number[]) =>
  grades.length === 0
    ? 0
    : (grades.reduce((sum, g) => sum + (g - 1) / 4, 0) / grades.length) * 100;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarise(results: ScenarioResult[]): EvalSummary {
  const rules = results.flatMap(ruleResults);
  const verdicts = results.flatMap((r) => (r.verdict ? [r.verdict] : []));
  const wearability = verdicts.flatMap((v) =>
    v.wearability === null ? [] : [v.wearability],
  );
  const parts = {
    rules: (rules.filter((c) => c.pass).length / (rules.length || 1)) * 100,
    tone: scaled(verdicts.map((v) => v.tone)),
    wearability: scaled(wearability),
  };
  return {
    scenarios: results.length,
    rules: round1(parts.rules),
    tone: round1(parts.tone),
    wearability: round1(parts.wearability),
    score: round1((parts.rules + parts.tone + parts.wearability) / 3),
    judgeFailures: results.length - verdicts.length,
  };
}

/** An empty reply is graded in code: judges were seen passing it. */
const NO_REPLY: Verdict = {
  ownedOnly: true,
  followsRules: false,
  tone: 1,
  wearability: null,
  reason: 'No reply.',
};

/** Runs every scenario in order; one at a time, because a local GPU serves one request well. */
export async function runEval(
  scenarios: EvalScenario[],
  subject: Subject,
  judge: Judge,
  onResult: (result: ScenarioResult) => void = () => {},
): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    const started = performance.now();
    const transcript = await subject(scenario.messages);
    const ms = Math.round(performance.now() - started);
    const result: ScenarioResult = {
      id: scenario.id,
      transcript,
      ms,
      checks: runChecks(scenario, transcript),
      verdict: transcript.answer.trim()
        ? await judge(scenario, transcript)
        : NO_REPLY,
    };
    results.push(result);
    onResult(result);
  }
  return results;
}
