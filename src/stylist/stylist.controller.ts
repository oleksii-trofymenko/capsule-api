import { Body, Controller, HttpCode, Inject, Post, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import {
  stylistChatSchema,
  type StylistChatRequest,
} from './stylist.schemas.js';
import { StylistService } from './stylist.service.js';

@ApiTags('stylist')
@ApiBearerAuth()
@Controller('stylist')
export class StylistController {
  constructor(
    @Inject(StylistService) private readonly stylist: StylistService,
  ) {}

  /**
   * Asks the stylist. Streams Server-Sent Events: each step of the graph, the
   * chosen outfit, the reply's tokens, then done. The client sends the whole
   * conversation; nothing is stored yet.
   */
  @Post('chat')
  @HttpCode(200)
  @ApiProduces('text/event-stream')
  @ApiResponse({
    status: 200,
    description: 'SSE stream of step, outfit, token, done and error events',
  })
  async chat(
    @CurrentUser() user: AuthUser,
    @Body({ schema: stylistChatSchema }) body: StylistChatRequest,
    @Res() res: Response,
  ): Promise<void> {
    const abort = new AbortController();
    // Stop paying for generation when the client disconnects.
    res.on('close', () => abort.abort());

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    for await (const event of this.stylist.chat(user.id, body, abort.signal)) {
      if (abort.signal.aborted) break;
      const { type, ...data } = event;
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    }
    res.end();
  }
}
