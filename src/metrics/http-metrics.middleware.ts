import type { NextFunction, Request, Response } from 'express';
import type { MetricsService } from './metrics.service.js';

/**
 * Plain Express middleware (rather than a Nest interceptor) so that requests
 * rejected by guards, 404s and errors are counted too.
 */
export function httpMetrics(metrics: MetricsService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      // Use the route pattern, never the raw URL: raw paths would create
      // unbounded label values (ids, scanners probing random URLs).
      const pattern = (req.route as { path?: string } | undefined)?.path;
      const route = pattern ? `${req.baseUrl}${pattern}` : 'unmatched';
      if (route === '/metrics') return;
      const labels = {
        method: req.method,
        route,
        status: String(res.statusCode),
      };
      metrics.httpRequests.inc(labels);
      metrics.httpDuration.observe(
        labels,
        Number(process.hrtime.bigint() - start) / 1e9,
      );
    });
    next();
  };
}
