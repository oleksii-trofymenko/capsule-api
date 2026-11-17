import { Module } from '@nestjs/common';
import { OCCASION_LIBRARY, readLibrary } from './load-occasions.js';
import { OccasionsService } from './occasions.service.js';

@Module({
  providers: [
    // Read and validated once at start-up: a bad data file stops the app.
    { provide: OCCASION_LIBRARY, useFactory: readLibrary },
    OccasionsService,
  ],
  exports: [OccasionsService],
})
export class OccasionsModule {}
