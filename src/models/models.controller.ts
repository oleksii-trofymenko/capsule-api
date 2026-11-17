import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ModelRouter } from './model-router.service.js';
import { modelsStatusSchema } from './models.schemas.js';

@ApiTags('models')
@ApiBearerAuth()
@Controller('models')
export class ModelsController {
  constructor(@Inject(ModelRouter) private readonly router: ModelRouter) {}

  /** Which model serves each task, and whether its provider is reachable. */
  @Get()
  @ApiResponse({ status: 200, standardSchema: modelsStatusSchema })
  async status() {
    return {
      routes: this.router.describe(),
      providers: await this.router.health(),
    };
  }
}
