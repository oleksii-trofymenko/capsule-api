import { eq } from 'drizzle-orm';
import { parseEnv } from '../../src/config/env.js';
import { knowledgePassages, knowledgeSources } from '../../src/db/schema.js';
import {
  KnowledgeService,
  MAX_PASSAGE_CHARS,
} from '../../src/knowledge/knowledge.service.js';
import { MetricsService } from '../../src/metrics/metrics.service.js';
import { ModelRouter } from '../../src/models/model-router.service.js';
import { TEST_ENV } from '../support/env.js';
import { FakeProvider } from '../support/fake-provider.js';
import { KeywordEmbeddings } from '../support/keyword-embeddings.js';
import { createTestDb } from '../support/test-db.js';

const NOW = new Date('2026-11-17T00:00:00Z');

// Written for this test; never text copied from a source.
const PASSAGES = {
  wedding:
    'Wedding guests dress smartly and avoid white so the couple stands out.',
  funeral: 'At a funeral, dark plain clothes show respect.',
  linen: 'Linen keeps you cool on hot summer days but creases easily.',
  boots: 'Leather boots need polish and rest between wears.',
};

async function setup(embedder = new KeywordEmbeddings()) {
  const { db, close } = await createTestDb();
  const router = new ModelRouter(
    parseEnv(TEST_ENV),
    [new FakeProvider([], undefined, embedder)],
    new MetricsService(),
  );
  const knowledge = new KnowledgeService(db, router);
  const sourceId = await knowledge.addSource({
    name: 'Capsule test notes',
    url: 'https://example.test/notes',
    licence: 'CC BY 4.0',
  });
  return { db, close, knowledge, sourceId };
}

describe('KnowledgeService', () => {
  it('stores passages with source, date and licence, and finds the relevant one first', async () => {
    const { close, knowledge, sourceId } = await setup();
    for (const text of Object.values(PASSAGES)) {
      await knowledge.addPassage({ sourceId, text, publishedOn: '2025-04-01' });
    }

    const hits = await knowledge.search('what should a wedding guest wear', {
      now: NOW,
    });

    expect(hits[0]).toMatchObject({
      text: PASSAGES.wedding,
      publishedOn: '2025-04-01',
      source: {
        name: 'Capsule test notes',
        url: 'https://example.test/notes',
        licence: 'CC BY 4.0',
      },
    });
    expect(hits[0].similarity).toBeGreaterThan(hits[1].similarity);
    const linen = await knowledge.search('cool fabric for summer', {
      now: NOW,
    });
    expect(linen[0].text).toBe(PASSAGES.linen);
    await close();
  });

  it('prefers the newer of two equally relevant passages', async () => {
    const { close, knowledge, sourceId } = await setup();
    await knowledge.addPassage({
      sourceId,
      text: 'Wide trousers are everywhere this year.',
      publishedOn: '2022-09-01',
    });
    const newer = await knowledge.addPassage({
      sourceId,
      text: 'Wide trousers are everywhere this year.',
      publishedOn: '2026-09-01',
    });

    const [first] = await knowledge.search('wide trousers', { now: NOW });
    expect(first.id).toBe(newer);
    await close();
  });

  it('keeps passages for other seasons out of a seasonal search', async () => {
    const { close, knowledge, sourceId } = await setup();
    await knowledge.addPassage({
      sourceId,
      text: PASSAGES.linen,
      publishedOn: '2026-05-01',
      seasons: ['summer'],
    });
    await knowledge.addPassage({
      sourceId,
      text: PASSAGES.boots,
      publishedOn: '2026-05-01',
    });

    const winter = await knowledge.search('linen boots', {
      season: 'winter',
      now: NOW,
    });
    expect(winter.map((h) => h.text)).toEqual([PASSAGES.boots]);
    const summer = await knowledge.search('linen boots', {
      season: 'summer',
      now: NOW,
    });
    expect(summer).toHaveLength(2);
    expect(summer.find((h) => h.text === PASSAGES.linen)?.seasons).toEqual([
      'summer',
    ]);
    await close();
  });

  it('compares only vectors made by the configured embedding model', async () => {
    const { db, close, knowledge, sourceId } = await setup();
    const embedding = await new KeywordEmbeddings().embedQuery(
      PASSAGES.wedding,
    );
    await db.insert(knowledgePassages).values({
      sourceId,
      text: PASSAGES.wedding,
      textHash: 'not-checked-here',
      publishedOn: '2026-01-01',
      embedding,
      embeddingModel: 'other:model',
    });

    expect(await knowledge.search('wedding guest', { now: NOW })).toEqual([]);
    await close();
  });

  it('refuses empty or over-long passages, which the model would silently cut', async () => {
    const { db, close, knowledge, sourceId } = await setup();
    for (const text of ['   ', 'x'.repeat(MAX_PASSAGE_CHARS + 1)]) {
      await expect(
        knowledge.addPassage({ sourceId, text, publishedOn: '2026-01-01' }),
      ).rejects.toThrow(RangeError);
    }
    expect(await db.select().from(knowledgePassages)).toEqual([]);
    await close();
  });

  it('says clearly when the embedding model does not fit the column', async () => {
    const { close, knowledge, sourceId } = await setup(
      new KeywordEmbeddings(5),
    );
    await expect(
      knowledge.addPassage({
        sourceId,
        text: PASSAGES.boots,
        publishedOn: '2026-01-01',
      }),
    ).rejects.toThrow(
      'The embedding model ollama:nomic-embed-text returns 5 numbers, but the knowledge base stores 768',
    );
    await close();
  });

  describe('addDocument', () => {
    const SOURCE = {
      name: 'Capsule test guide',
      url: null,
      licence: 'CC BY 4.0',
    };
    // Three paragraphs too long to share a passage, so the document becomes three passages.
    const DOCUMENT = Object.values(PASSAGES)
      .slice(0, 3)
      .map((p) => `${p} `.repeat(12))
      .join('\n\n');
    const add = (knowledge: KnowledgeService) =>
      knowledge.addDocument({
        source: SOURCE,
        text: DOCUMENT,
        publishedOn: '2026-03-01',
      });

    it('adds a document once: running it again changes nothing and calls no model', async () => {
      const embedder = new KeywordEmbeddings();
      const { db, close, knowledge } = await setup(embedder);

      const first = await add(knowledge);
      const embed = vi.spyOn(embedder, 'embedDocuments');
      const second = await add(knowledge);

      expect(first).toMatchObject({ added: 3, skipped: 0 });
      expect(second).toEqual({ ...first, added: 0, skipped: 3 });
      expect(embed).not.toHaveBeenCalled();
      expect(
        await db
          .select()
          .from(knowledgeSources)
          .where(eq(knowledgeSources.name, SOURCE.name)),
      ).toHaveLength(1);
      const passages = await db
        .select()
        .from(knowledgePassages)
        .where(eq(knowledgePassages.sourceId, first.sourceId));
      expect(passages).toHaveLength(3);
      expect(passages.every((p) => p.publishedOn === '2026-03-01')).toBe(true);
      expect(
        (await knowledge.search('linen summer', { now: NOW }))[0],
      ).toMatchObject({
        source: { name: SOURCE.name, licence: SOURCE.licence },
      });
      await close();
    });

    it('finishes a document that failed part-way without duplicating the first part', async () => {
      const embedder = new KeywordEmbeddings();
      const { db, close, knowledge } = await setup(embedder);
      const real = embedder.embedDocuments.bind(embedder);
      vi.spyOn(embedder, 'embedDocuments')
        .mockImplementationOnce(real)
        .mockRejectedValueOnce(new Error('model went away'));

      await expect(add(knowledge)).rejects.toThrow('model went away');
      const rerun = await add(knowledge);

      expect(rerun).toMatchObject({ added: 2, skipped: 1 });
      expect(
        await db
          .select()
          .from(knowledgePassages)
          .where(eq(knowledgePassages.sourceId, rerun.sourceId)),
      ).toHaveLength(3);
      await close();
    });

    it('refuses a known source under a different licence', async () => {
      const { db, close, knowledge } = await setup();
      await add(knowledge);

      await expect(
        knowledge.addDocument({
          source: { ...SOURCE, licence: 'All rights reserved' },
          text: 'Something new.',
          publishedOn: '2026-03-01',
        }),
      ).rejects.toThrow('already recorded with the licence "CC BY 4.0"');
      const [source] = await db
        .select()
        .from(knowledgeSources)
        .where(eq(knowledgeSources.name, SOURCE.name));
      expect(source.licence).toBe('CC BY 4.0');
      await close();
    });
  });

  it('removes a source together with its passages', async () => {
    const { db, close, knowledge, sourceId } = await setup();
    await knowledge.addPassage({
      sourceId,
      text: PASSAGES.funeral,
      publishedOn: '2026-01-01',
    });

    await db.delete(knowledgeSources).where(eq(knowledgeSources.id, sourceId));

    expect(await db.select().from(knowledgePassages)).toEqual([]);
    await close();
  });
});
