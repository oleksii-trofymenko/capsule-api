/**
 * `npm run ingest -- <file or web address> --name <source> --licence <licence> --published YYYY-MM-DD [--url <address>]`
 *
 * Adds one document to the knowledge base: a .txt, .md, .html, .pdf or .epub
 * file, or a web page. Running it again adds only passages that are missing.
 * Ingest only sources listed in docs/SOURCES.md. Needs the database and the
 * embedding model.
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { ConfigModule } from '../config/config.module.js';
import { DbModule } from '../db/db.module.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { extract, formatOf } from './extract.js';
import { KnowledgeModule } from './knowledge.module.js';
import { KnowledgeService } from './knowledge.service.js';

const argsSchema = z.object({
  input: z.string().min(1),
  name: z.string().trim().min(1),
  licence: z.string().trim().min(1),
  // Required, never "today": retrieval ranks passages by this date.
  published: z.iso.date(),
  url: z.url().optional(),
});

@Module({ imports: [ConfigModule, MetricsModule, DbModule, KnowledgeModule] })
class IngestModule {}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    licence: { type: 'string' },
    published: { type: 'string' },
    url: { type: 'string' },
  },
});
const parsed = argsSchema.safeParse({ ...values, input: positionals[0] });
if (!parsed.success) {
  console.error(
    `${z.prettifyError(parsed.error)}\n\nUsage: npm run ingest -- <file or web address> --name <source> --licence <licence> --published YYYY-MM-DD [--url <address>]`,
  );
  process.exit(1);
}
const args = parsed.data;
const isWeb = /^https?:\/\//i.test(args.input);
const format = formatOf(args.input);

const data = isWeb ? await download(args.input) : await readFile(args.input);
const text = await extract(data, format);

const app = await NestFactory.createApplicationContext(IngestModule, {
  logger: ['error'],
});
try {
  const started = Date.now();
  const result = await app.get(KnowledgeService).addDocument({
    source: {
      name: args.name,
      url: args.url ?? (isWeb ? args.input : null),
      licence: args.licence,
    },
    text,
    publishedOn: args.published,
  });
  console.log(
    `${args.name}: ${result.added} passages added, ${result.skipped} already there (${format}, ${((Date.now() - started) / 1000).toFixed(1)}s)`,
  );
} finally {
  await app.close();
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('html')) {
    throw new Error(`${url} is not a web page (${type || 'no content type'})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
