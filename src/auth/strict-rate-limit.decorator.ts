import { SetMetadata } from '@nestjs/common';

export const STRICT_RATE_LIMIT = 'strictRateLimit';

/** Applies AUTH_RATE_LIMIT_PER_MINUTE instead of the general limit (credential endpoints). */
export const StrictRateLimit = () => SetMetadata(STRICT_RATE_LIMIT, true);
