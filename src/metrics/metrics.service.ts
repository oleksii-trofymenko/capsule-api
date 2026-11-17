import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from '@prometheus-io/client';

/**
 * One registry per application instance (not the library's global one),
 * so tests can create several apps in the same process.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: 'http_requests_total',
    help: 'HTTP requests handled',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly llmRequests = new Counter({
    name: 'llm_requests_total',
    help: 'Model calls made through the model router',
    labelNames: ['task', 'provider', 'model', 'outcome'] as const,
    registers: [this.registry],
  });

  readonly llmDuration = new Histogram({
    name: 'llm_request_duration_seconds',
    help: 'Model call duration in seconds',
    labelNames: ['task', 'provider', 'model', 'outcome'] as const,
    buckets: [0.25, 0.5, 1, 2, 5, 10, 20, 40, 80, 160],
    registers: [this.registry],
  });

  readonly llmTokens = new Counter({
    name: 'llm_tokens_total',
    help: 'Tokens reported by the model provider',
    labelNames: ['task', 'provider', 'model', 'direction'] as const,
    registers: [this.registry],
  });

  readonly storageRequests = new Counter({
    name: 'storage_requests_total',
    help: 'Calls to photo object storage',
    labelNames: ['operation', 'outcome'] as const,
    registers: [this.registry],
  });

  readonly storageDuration = new Histogram({
    name: 'storage_request_duration_seconds',
    help: 'Photo object storage call duration in seconds',
    labelNames: ['operation', 'outcome'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [this.registry],
  });

  readonly photoTagging = new Counter({
    name: 'photo_tagging_total',
    help: 'Photos processed by vision tagging',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });

  readonly photoTaggingDuration = new Histogram({
    name: 'photo_tagging_duration_seconds',
    help: 'Time to tag one photo, including reading it from storage',
    labelNames: ['outcome'] as const,
    buckets: [0.5, 1, 2, 5, 10, 20, 40, 80, 160],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }
}
