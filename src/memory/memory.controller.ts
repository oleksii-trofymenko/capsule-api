import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { noteIdSchema, notesSchema } from './memory.schemas.js';
import { MemoryService } from './memory.service.js';

/** What Capsule remembers about the signed-in person, which they can see and delete. */
@ApiTags('memory')
@ApiBearerAuth()
@Controller('memory')
export class MemoryController {
  constructor(@Inject(MemoryService) private readonly memory: MemoryService) {}

  @Get()
  @ApiResponse({ status: 200, standardSchema: notesSchema })
  async list(@CurrentUser() user: AuthUser) {
    return { notes: await this.memory.list(user.id) };
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Note forgotten' })
  @ApiResponse({ status: 404, description: 'No such note for this user' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: noteIdSchema }) id: string,
  ) {
    await this.memory.remove(user.id, id);
  }

  @Delete()
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Every note forgotten' })
  async clear(@CurrentUser() user: AuthUser) {
    await this.memory.clear(user.id);
  }
}
