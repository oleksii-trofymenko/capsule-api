import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Locale } from '../locale.js';
import { MemoryService } from '../memory/memory.service.js';
import { NOTE_STORE, type NoteStore } from '../memory/note-store.js';
import { ModelRouter } from '../models/model-router.service.js';
import { OccasionsService } from '../occasions/occasions.service.js';
import { ProfileService } from '../profile/profile.service.js';
import { WardrobeService } from '../wardrobe/wardrobe.service.js';
import {
  STYLIST_CONTEXT,
  type StylistContext,
  type StylistContextSource,
} from './context.js';
import { OUTFIT_STORE, type OutfitStore } from '../outfits/outfit-store.js';
import { TRACE_STORE, type TraceStore } from '../traces/trace-store.js';
import type { NewTrace } from '../traces/traces.schemas.js';
import { buildStylistGraph, type StylistGraph } from './graph.js';
import type {
  Consulted,
  StylistChatRequest,
  StylistEvent,
} from './stylist.schemas.js';
import { TraceRecorder } from './trace-recorder.js';

/** English only for now; the user's locale is not modelled yet. */
const LOCALE: Locale = 'en';

/** The signed-in user's wardrobe and profile, from the database. */
@Injectable()
export class DbContextSource implements StylistContextSource {
  constructor(
    @Inject(WardrobeService) private readonly wardrobe: WardrobeService,
    @Inject(ProfileService) private readonly profiles: ProfileService,
    @Inject(MemoryService) private readonly memory: MemoryService,
  ) {}

  async load(userId: string): Promise<StylistContext> {
    const [wardrobe, profile, notes] = await Promise.all([
      this.wardrobe.list(userId),
      this.profiles.answers(userId),
      this.memory.list(userId),
    ]);
    return {
      wardrobe,
      profile,
      notes: notes.map(({ kind, text }) => ({ kind, text })),
    };
  }
}

@Injectable()
export class StylistService {
  private readonly logger = new Logger(StylistService.name);
  private readonly graph: StylistGraph;

  constructor(
    @Inject(ModelRouter) models: ModelRouter,
    @Inject(OccasionsService) occasions: OccasionsService,
    @Inject(STYLIST_CONTEXT) context: StylistContextSource,
    @Inject(OUTFIT_STORE) private readonly outfits: OutfitStore,
    @Inject(NOTE_STORE) notes: NoteStore,
    @Inject(TRACE_STORE) private readonly traces: TraceStore,
  ) {
    this.graph = buildStylistGraph({
      models,
      occasions,
      context,
      notes,
      logger: this.logger,
    });
  }

  /** Runs the graph and yields each step, the outfit and the reply's tokens as they happen. */
  async *chat(
    userId: string,
    request: StylistChatRequest,
    signal?: AbortSignal,
    now: Date = new Date(),
  ): AsyncGenerator<StylistEvent> {
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    let firstTokenMs: number | null = null;
    let consulted: Consulted[] = [];
    const recorder = new TraceRecorder();
    const trace: Omit<NewTrace, 'calls' | 'failed'> = {
      steps: [],
      occasion: null,
      candidates: [],
      outfit: [],
    };
    try {
      const stream = await this.graph.stream(
        { userId, locale: LOCALE, now, messages: request.messages },
        { streamMode: ['custom', 'values'], signal, callbacks: [recorder] },
      );
      for await (const [mode, chunk] of stream) {
        if (mode === 'values') {
          consulted = chunk.consulted;
          trace.occasion = chunk.occasion?.id ?? null;
          trace.candidates = chunk.candidates.map((i) => i.name);
          continue;
        }
        // Custom chunks are the StylistEvents the graph's nodes emit.
        const event = chunk as StylistEvent;
        if (event.type === 'token') firstTokenMs ??= elapsed();
        if (event.type === 'step') trace.steps.push(event.step);
        if (event.type === 'outfit') {
          trace.outfit = event.items.map((i) => i.name);
          yield { ...event, id: await this.save(userId, event) };
        } else {
          yield event;
        }
      }
      const traceId = await this.keep(userId, {
        ...trace,
        calls: recorder.calls,
        failed: false,
      });
      yield { type: 'done', ms: elapsed(), firstTokenMs, consulted, traceId };
    } catch (error) {
      if (signal?.aborted) return;
      // Log what failed, never the conversation itself.
      this.logger.error(
        `Stylist run failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      const traceId = await this.keep(userId, {
        ...trace,
        calls: recorder.calls,
        failed: true,
      });
      yield {
        type: 'error',
        message: 'The stylist could not answer just now. Please try again.',
        traceId,
      };
    }
  }

  /** Keeps the trace so the person can open this answer later. A failure costs the trace, not the reply. */
  private async keep(userId: string, trace: NewTrace): Promise<string | null> {
    try {
      return await this.traces.save(userId, trace);
    } catch (error) {
      this.logger.error(
        `Saving a trace failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  /** Saves a suggested outfit so feedback can attach to it. A failure costs the id, not the reply. */
  private async save(
    userId: string,
    event: Extract<StylistEvent, { type: 'outfit' }>,
  ): Promise<string | null> {
    if (event.items.length === 0) return null;
    try {
      return await this.outfits.save(userId, {
        occasionId: event.occasion,
        items: event.items.map((i) => ({ itemId: i.id, name: i.name })),
      });
    } catch (error) {
      this.logger.error(
        `Saving an outfit failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }
}
