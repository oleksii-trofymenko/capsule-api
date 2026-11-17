import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import {
  createUploadSchema,
  photoIdSchema,
  photoSchema,
  photoUploadSchema,
  type CreateUploadInput,
} from './photos.schemas.js';
import { PhotosService } from './photos.service.js';

@ApiTags('photos')
@ApiBearerAuth()
@Controller('photos')
export class PhotosController {
  constructor(@Inject(PhotosService) private readonly photos: PhotosService) {}

  /** Starts an upload: returns a short-lived URL the client sends the file to directly. */
  @Post()
  @ApiResponse({ status: 201, standardSchema: photoUploadSchema })
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createUploadSchema }) body: CreateUploadInput,
  ) {
    return this.photos.createUpload(user.id, body);
  }

  /** Call after the upload succeeds. */
  @Post(':id/complete')
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: photoSchema })
  @ApiResponse({ status: 404, description: 'No such photo for this user' })
  @ApiResponse({ status: 409, description: 'The file has not arrived yet' })
  @ApiResponse({
    status: 422,
    description: 'The file differs from the declared size or type',
  })
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: photoIdSchema }) id: string,
  ) {
    return this.photos.complete(user.id, id);
  }
}
