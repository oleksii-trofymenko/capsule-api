import { Module } from '@nestjs/common';
import { ModelsModule } from '../models/models.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { TaggingService } from './tagging.service.js';

@Module({
  imports: [ModelsModule, StorageModule],
  providers: [TaggingService],
  exports: [TaggingService],
})
export class TaggingModule {}
