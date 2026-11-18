/**
 * `npm run eval`: runs every scenario against the stylist with the configured
 * models, grades the replies, and prints the score. Full replies are written
 * to eval-results/ for reading. Needs Ollama, not the database.
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ConfigModule } from '../config/config.module.js';
import { NOTE_STORE, type NoteStore } from '../memory/note-store.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { ModelRouter } from '../models/model-router.service.js';
import { ModelsModule } from '../models/models.module.js';
import { OccasionsModule } from '../occasions/occasions.module.js';
import { OUTFIT_STORE, type OutfitStore } from '../outfits/outfit-store.js';
import { sampleWardrobe } from '../playground/sample-data.js';
import type { Locale } from '../locale.js';
import {
  STYLIST_CONTEXT,
  type StylistContextSource,
} from '../stylist/context.js';
import type { Consulted } from '../stylist/stylist.schemas.js';
import { StylistService } from '../stylist/stylist.service.js';
import { runEval, ruleResults, summarise, type Subject } from './evaluate.js';
import { createJudge } from './judge.js';
import { evalScenarios } from './scenarios.js';

/** The person under test owns the sample wardrobe the judge is told about, and has no profile. */
const sampleContext: StylistContextSource = {
  load: async () => ({ wardrobe: sampleWardrobe, profile: null, notes: [] }),
};

/** Each scenario is a fresh conversation, so nothing it says is kept for the next. */
const forgetNotes: NoteStore = { add: async () => {} };

/** Suggested outfits are kept in memory: the evaluation needs no database. */
let saved = 0;
const memoryOutfits: OutfitStore = {
  save: async () => `eval-outfit-${(saved += 1)}`,
};

@Module({
  imports: [ConfigModule, MetricsModule, ModelsModule, OccasionsModule],
  providers: [
    StylistService,
    { provide: STYLIST_CONTEXT, useValue: sampleContext },
    { provide: OUTFIT_STORE, useValue: memoryOutfits },
    { provide: NOTE_STORE, useValue: forgetNotes },
  ],
})
class EvalModule {}

/**
 * Scenarios name the tools of the old playground chat. The graph has no tools;
 * it reports what it actually gave the model on this turn, mapped here.
 */
const TOOL_FOR: Record<Consulted, string> = {
  wardrobe: 'search_wardrobe',
  'dress-code': 'get_dress_code',
  date: 'get_today',
};

const locale: Locale = 'en';
const app = await NestFactory.createApplicationContext(EvalModule, {
  logger: ['error'],
});
const stylist = app.get(StylistService);
const models = app.get(ModelRouter);
const route = models.describe().reasoning;

// The stylist under test: the stylist graph.
const subject: Subject = async (messages) => {
  let answer = '';
  let tools: string[] = [];
  for await (const event of stylist.chat('eval-user', { messages })) {
    if (event.type === 'token') answer += event.text;
    if (event.type === 'done') tools = event.consulted.map((c) => TOOL_FOR[c]);
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
