import type { EvalScenario } from './scenarios.js';

/** What the stylist did for one scenario. */
export interface Transcript {
  answer: string;
  tools: string[];
}

export interface CheckResult {
  name: string;
  pass: boolean;
}

/** Model reasoning or channel markers that should never reach a user. */
const LEAKED_REASONING =
  /<\|?channel\|?>|\bthe user (wants|asked|is asking|needs)\b/i;
/** Internal wardrobe ids, such as `w09`. */
const ITEM_ID = /\bw\d{2}\b/;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Checks that need no model: run on every reply, plus the scenario's own. */
export function runChecks(
  scenario: EvalScenario,
  transcript: Transcript,
): CheckResult[] {
  const { answer, tools } = transcript;
  const checks = scenario.checks ?? {};
  const results: CheckResult[] = [
    { name: 'answered', pass: answer.trim().length > 0 },
    { name: 'no leaked reasoning', pass: !LEAKED_REASONING.test(answer) },
    { name: 'no internal ids', pass: !ITEM_ID.test(answer) },
  ];
  for (const tool of checks.tools ?? []) {
    results.push({ name: `calls ${tool}`, pass: tools.includes(tool) });
  }
  for (const pattern of checks.mentions ?? []) {
    results.push({
      name: `mentions ${pattern.source}`,
      pass: pattern.test(answer),
    });
  }
  for (const pattern of checks.avoid ?? []) {
    results.push({
      name: `avoids ${pattern.source}`,
      pass: !pattern.test(answer),
    });
  }
  if (checks.asks) {
    results.push({ name: 'asks a question', pass: answer.includes('?') });
  }
  if (checks.budget) {
    const { currency, max } = checks.budget;
    const price = new RegExp(`${escape(currency)}\\s?(\\d+(?:\\.\\d+)?)`, 'g');
    const prices = [...answer.matchAll(price)].map((m) => Number(m[1]));
    results.push({
      name: `stays within ${currency}${max}`,
      pass: prices.every((p) => p <= max),
    });
  }
  return results;
}
