import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { traceIdSchema, traceSchema } from './traces.schemas.js';
import { TracesService } from './traces.service.js';

/** Opens one of the signed-in person's stylist answers to show how it was made. */
@ApiTags('stylist')
@ApiBearerAuth()
@Controller('stylist/traces')
export class TracesController {
  constructor(@Inject(TracesService) private readonly traces: TracesService) {}

  @Get(':id')
  @ApiResponse({ status: 200, standardSchema: traceSchema })
  @ApiResponse({ status: 404, description: 'No such trace for this user' })
  async get(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: traceIdSchema }) id: string,
  ) {
    return this.traces.get(user.id, id);
  }
}
