import { Module } from '@nestjs/common';
import { WardrobeController } from './wardrobe.controller.js';
import { WardrobeService } from './wardrobe.service.js';

@Module({
  controllers: [WardrobeController],
  providers: [WardrobeService],
  exports: [WardrobeService],
})
export class WardrobeModule {}
