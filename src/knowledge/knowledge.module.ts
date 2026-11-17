import { Module } from '@nestjs/common';
import { ModelsModule } from '../models/models.module.js';
import { KnowledgeService } from './knowledge.service.js';

@Module({
  imports: [ModelsModule],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
