import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';
import { buildQuiz } from './build-quiz.js';
import {
  profileAnswersSchema,
  profileSchema,
  quizSchema,
  type ProfileAnswers,
} from './profile.schemas.js';
import { ProfileService } from './profile.service.js';

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(
    @Inject(ProfileService) private readonly profiles: ProfileService,
  ) {}

  /** The onboarding quiz: questions, options and limits. */
  @Get('quiz')
  @ApiResponse({ status: 200, standardSchema: quizSchema })
  quiz() {
    return buildQuiz('en');
  }

  @Get()
  @ApiResponse({ status: 200, standardSchema: profileSchema })
  get(@CurrentUser() user: AuthUser) {
    return this.profiles.get(user.id);
  }

  /** Saves the quiz answers. Sending them again replaces the profile. */
  @Put()
  @ApiResponse({ status: 200, standardSchema: profileSchema })
  save(
    @CurrentUser() user: AuthUser,
    @Body({ schema: profileAnswersSchema }) body: ProfileAnswers,
  ) {
    return this.profiles.save(user.id, body);
  }
}
