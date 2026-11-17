import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { WardrobeController } from './wardrobe.controller.js';
import { WardrobeService } from './wardrobe.service.js';

@Module({
  imports: [StorageModule],
  controllers: [WardrobeController],
  providers: [WardrobeService],
  exports: [WardrobeService],
})
export class WardrobeModule {}
