import { Module } from '@nestjs/common';
import { ModelsModule } from '../models/models.module.js';
import { PlaygroundController } from './playground.controller.js';
import { PlaygroundService } from './playground.service.js';

@Module({
  imports: [ModelsModule],
  controllers: [PlaygroundController],
  providers: [PlaygroundService],
})
export class PlaygroundModule {}
