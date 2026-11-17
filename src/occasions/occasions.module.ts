import { Module } from '@nestjs/common';
import { OccasionsService } from './occasions.service.js';

@Module({
  providers: [OccasionsService],
  exports: [OccasionsService],
})
export class OccasionsModule {}
