import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import {
  createItemSchema,
  itemIdSchema,
  itemListSchema,
  itemSchema,
  updateItemSchema,
  type CreateItemInput,
  type UpdateItemInput,
} from './wardrobe.schemas.js';
import { WardrobeService } from './wardrobe.service.js';

const NOT_FOUND = { status: 404, description: 'No such item for this user' };
const BAD_PHOTO = {
  status: 422,
  description: 'photoId is not an uploaded photo of yours',
};

@ApiTags('wardrobe')
@ApiBearerAuth()
@Controller('wardrobe/items')
export class WardrobeController {
  constructor(
    @Inject(WardrobeService) private readonly wardrobe: WardrobeService,
  ) {}

  @Post()
  @ApiResponse({ status: 201, standardSchema: itemSchema })
  @ApiResponse(BAD_PHOTO)
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createItemSchema }) body: CreateItemInput,
  ) {
    return this.wardrobe.create(user.id, body);
  }

  @Get()
  @ApiResponse({ status: 200, standardSchema: itemListSchema })
  async list(@CurrentUser() user: AuthUser) {
    return { items: await this.wardrobe.list(user.id) };
  }

  @Get(':id')
  @ApiResponse({ status: 200, standardSchema: itemSchema })
  @ApiResponse(NOT_FOUND)
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: itemIdSchema }) id: string,
  ) {
    return this.wardrobe.get(user.id, id);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, standardSchema: itemSchema })
  @ApiResponse(NOT_FOUND)
  @ApiResponse(BAD_PHOTO)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: itemIdSchema }) id: string,
    @Body({ schema: updateItemSchema }) body: UpdateItemInput,
  ) {
    return this.wardrobe.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Item deleted' })
  @ApiResponse(NOT_FOUND)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: itemIdSchema }) id: string,
  ) {
    await this.wardrobe.remove(user.id, id);
  }
}
