import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Locale } from '../locale.js';
import { ModelRouter } from '../models/model-router.service.js';
import { OccasionsService } from '../occasions/occasions.service.js';
import { ProfileService } from '../profile/profile.service.js';
import { WardrobeService } from '../wardrobe/wardrobe.service.js';
import {
  STYLIST_CONTEXT,
  type StylistContext,
  type StylistContextSource,
} from './context.js';
import { buildStylistGraph, type StylistGraph } from './graph.js';
import type {
  Consulted,
  StylistChatRequest,
  StylistEvent,
} from './stylist.schemas.js';

/** English only for now; the user's locale is not modelled yet. */
const LOCALE: Locale = 'en';

/** The signed-in user's wardrobe and profile, from the database. */
@Injectable()
export class DbContextSource implements StylistContextSource {
  constructor(
    @Inject(WardrobeService) private readonly wardrobe: WardrobeService,
    @Inject(ProfileService) private readonly profiles: ProfileService,
  ) {}

  async load(userId: string): Promise<StylistContext> {
    const [wardrobe, { profile }] = await Promise.all([
      this.wardrobe.list(userId),
      this.profiles.get(userId),
    ]);
    return { wardrobe, profile };
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
  ) {
    this.graph = buildStylistGraph({
      models,
      occasions,
      context,
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
    try {
      const stream = await this.graph.stream(
        { userId, locale: LOCALE, now, messages: request.messages },
        { streamMode: ['custom', 'values'], signal },
      );
      for await (const [mode, chunk] of stream) {
        if (mode === 'values') {
          consulted = chunk.consulted;
          continue;
        }
        // Custom chunks are the StylistEvents the graph's nodes emit.
        const event = chunk as StylistEvent;
        if (event.type === 'token') firstTokenMs ??= elapsed();
        yield event;
      }
      yield { type: 'done', ms: elapsed(), firstTokenMs, consulted };
    } catch (error) {
      if (signal?.aborted) return;
      // Log what failed, never the conversation itself.
      this.logger.error(
        `Stylist run failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      yield {
        type: 'error',
        message: 'The stylist could not answer just now. Please try again.',
      };
    }
  }
}
