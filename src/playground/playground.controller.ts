import {
  Body,
  Controller,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { chatRequestSchema, type ChatRequest } from './playground.schemas.js';
import { PlaygroundService } from './playground.service.js';

@ApiTags('playground')
@ApiBearerAuth()
@Controller('playground')
export class PlaygroundController {
  constructor(
    @Inject(PlaygroundService) private readonly playground: PlaygroundService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Test chat for developers: streams tokens, tool calls and timings as
   * Server-Sent Events. Stateless; the client sends the whole conversation.
   */
  @Post('chat')
  @HttpCode(200)
  @ApiProduces('text/event-stream')
  @ApiResponse({
    status: 200,
    description:
      'SSE stream of start, token, tool_call, tool_result, done and error events',
  })
  async chat(
    @Body({ schema: chatRequestSchema }) body: ChatRequest,
    @Res() res: Response,
  ): Promise<void> {
    if (this.env.NODE_ENV === 'production') throw new NotFoundException();

    const abort = new AbortController();
    // Stop paying for generation when the browser disconnects or presses Stop.
    res.on('close', () => abort.abort());

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    for await (const event of this.playground.chat(body, abort.signal)) {
      if (abort.signal.aborted) break;
      const { type, ...data } = event;
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    }
    res.end();
  }
}
