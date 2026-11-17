import { Module } from '@nestjs/common';
import { ModelsModule } from '../models/models.module.js';
import { OccasionsModule } from '../occasions/occasions.module.js';
import { OutfitsModule } from '../outfits/outfits.module.js';
import { ProfileModule } from '../profile/profile.module.js';
import { WardrobeModule } from '../wardrobe/wardrobe.module.js';
import { STYLIST_CONTEXT } from './context.js';
import { StylistController } from './stylist.controller.js';
import { DbContextSource, StylistService } from './stylist.service.js';

@Module({
  imports: [
    ModelsModule,
    OccasionsModule,
    WardrobeModule,
    ProfileModule,
    OutfitsModule,
  ],
  controllers: [StylistController],
  providers: [
    StylistService,
    { provide: STYLIST_CONTEXT, useClass: DbContextSource },
  ],
})
export class StylistModule {}
