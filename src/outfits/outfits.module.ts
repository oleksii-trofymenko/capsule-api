import { Module } from '@nestjs/common';
import { OccasionsModule } from '../occasions/occasions.module.js';
import { OUTFIT_STORE } from './outfit-store.js';
import { OutfitsController } from './outfits.controller.js';
import { OutfitsService } from './outfits.service.js';

@Module({
  imports: [OccasionsModule],
  controllers: [OutfitsController],
  providers: [
    OutfitsService,
    { provide: OUTFIT_STORE, useExisting: OutfitsService },
  ],
  exports: [OutfitsService, OUTFIT_STORE],
})
export class OutfitsModule {}
