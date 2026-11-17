import {
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  UnauthorizedException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../auth/public.decorator.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { MetricsService } from './metrics.service.js';

@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(
    @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Prometheus scrape endpoint. Protected by METRICS_TOKEN when one is configured. */
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  scrape(@Headers('authorization') authorization?: string) {
    const expected = this.env.METRICS_TOKEN;
    if (expected && !sameString(authorization ?? '', `Bearer ${expected}`)) {
      throw new UnauthorizedException();
    }
    return this.metrics.registry.metrics();
  }
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
