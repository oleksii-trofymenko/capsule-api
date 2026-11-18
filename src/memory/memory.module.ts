import { Module } from '@nestjs/common';
import { MemoryController } from './memory.controller.js';
import { MemoryService } from './memory.service.js';
import { NOTE_STORE } from './note-store.js';

@Module({
  controllers: [MemoryController],
  providers: [
    MemoryService,
    { provide: NOTE_STORE, useExisting: MemoryService },
  ],
  exports: [MemoryService, NOTE_STORE],
})
export class MemoryModule {}
