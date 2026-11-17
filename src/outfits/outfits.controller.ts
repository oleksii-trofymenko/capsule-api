import { Body, Controller, Inject, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import {
  feedbackSchema,
  outfitIdSchema,
  outfitSchema,
  type FeedbackInput,
} from './outfits.schemas.js';
import { OutfitsService } from './outfits.service.js';

@ApiTags('outfits')
@ApiBearerAuth()
@Controller('outfits')
export class OutfitsController {
  constructor(
    @Inject(OutfitsService) private readonly outfits: OutfitsService,
  ) {}

  /** Like or dislike an outfit the stylist suggested, mark it worn, or add a note. */
  @Patch(':id/feedback')
  @ApiResponse({ status: 200, standardSchema: outfitSchema })
  @ApiResponse({ status: 404, description: 'No such outfit for this user' })
  feedback(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: outfitIdSchema }) id: string,
    @Body({ schema: feedbackSchema }) body: FeedbackInput,
  ) {
    return this.outfits.setFeedback(user.id, id, body);
  }
}
