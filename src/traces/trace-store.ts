import type { NewTrace } from './traces.schemas.js';

/** Where the stylist keeps the trace of each answer. The app uses the database; the evaluation keeps them in memory. */
export interface TraceStore {
  save(userId: string, trace: NewTrace): Promise<string>;
}

export const TRACE_STORE = Symbol('TRACE_STORE');
