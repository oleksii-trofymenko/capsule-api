import { Module } from '@nestjs/common';
import { TRACE_STORE } from './trace-store.js';
import { TracesController } from './traces.controller.js';
import { TracesService } from './traces.service.js';

@Module({
  controllers: [TracesController],
  providers: [
    TracesService,
    { provide: TRACE_STORE, useExisting: TracesService },
  ],
  exports: [TRACE_STORE],
})
export class TracesModule {}
