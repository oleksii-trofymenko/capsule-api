/**
 * `npm run eval`: runs every scenario against the stylist with the configured
 * models, grades the replies, and prints the score. Full replies are written
 * to eval-results/ for reading. Needs Ollama, not the database.
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ConfigModule } from '../config/config.module.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { ModelRouter } from '../models/model-router.service.js';
import { ModelsModule } from '../models/models.module.js';
import { PlaygroundModule } from '../playground/playground.module.js';
import { PlaygroundService } from '../playground/playground.service.js';
import { sampleWardrobe } from '../playground/sample-data.js';
import type { Locale } from '../locale.js';
import { runEval, ruleResults, summarise, type Subject } from './evaluate.js';
import { createJudge } from './judge.js';
import { evalScenarios } from './scenarios.js';

@Module({
  imports: [ConfigModule, MetricsModule, ModelsModule, PlaygroundModule],
})
class EvalModule {}

const locale: Locale = 'en';
const app = await NestFactory.createApplicationContext(EvalModule, {
  logger: ['error'],
});
const playground = app.get(PlaygroundService);
const models = app.get(ModelRouter);
const route = models.describe().reasoning;

// The stylist under test. T11 replaces the playground with the stylist graph.
const subject: Subject = async (messages) => {
  let answer = '';
  const tools: string[] = [];
  for await (const event of playground.chat({ messages, tools: true })) {
    if (event.type === 'token') answer += event.text;
    if (event.type === 'tool_call') tools.push(event.name);
  }
  return { answer, tools };
};

const judge = createJudge(
  models.chat('reasoning'),
  locale,
  sampleWardrobe.map((item) => item.name),
);

console.log(`Evaluating ${route.provider}:${route.model} (${locale})\n`);
const results = await runEval(evalScenarios[locale], subject, judge, (r) => {
  const rules = ruleResults(r);
  const passed = rules.filter((c) => c.pass).length;
  const failed = rules.filter((c) => !c.pass).map((c) => c.name);
  const v = r.verdict;
  console.log(
    `${passed === rules.length ? 'PASS' : 'FAIL'}  ${r.id.padEnd(22)} rules ${passed}/${rules.length}` +
      `  tone ${v?.tone ?? '-'}  wear ${v?.wearability ?? '-'}  ${(r.ms / 1000).toFixed(1)}s` +
      (failed.length ? `\n      failed: ${failed.join('; ')}` : ''),
  );
});

const summary = summarise(results);
console.log(
  `\nRules ${summary.rules}  Tone ${summary.tone}  Wearability ${summary.wearability}` +
    `\nScore ${summary.score} / 100   (judge failures: ${summary.judgeFailures})`,
);

mkdirSync('eval-results', { recursive: true });
const file = `eval-results/${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(
  file,
  JSON.stringify({ model: route, locale, summary, results }, null, 2),
);
console.log(`Full replies: ${file}`);
await app.close();
