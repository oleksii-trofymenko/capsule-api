import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { TaggingModule } from '../tagging/tagging.module.js';
import { PhotosController } from './photos.controller.js';
import { PhotosService } from './photos.service.js';

@Module({
  imports: [StorageModule, TaggingModule],
  controllers: [PhotosController],
  providers: [PhotosService],
})
export class PhotosModule {}
