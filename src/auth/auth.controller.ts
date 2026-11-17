import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StrictRateLimit } from './strict-rate-limit.decorator.js';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  tokensSchema,
  userSchema,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
} from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import { CurrentUser, type AuthUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @StrictRateLimit()
  @Post('register')
  @ApiResponse({ status: 201, standardSchema: tokensSchema })
  @ApiResponse({ status: 409, description: 'Email is already registered' })
  register(@Body({ schema: registerSchema }) body: RegisterInput) {
    return this.auth.register(body.email, body.password);
  }

  @Public()
  @StrictRateLimit()
  @Post('login')
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: tokensSchema })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  login(@Body({ schema: loginSchema }) body: LoginInput) {
    return this.auth.login(body.email, body.password);
  }

  @Public()
  @StrictRateLimit()
  @Post('refresh')
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: tokensSchema })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  refresh(@Body({ schema: refreshSchema }) body: RefreshInput) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Session revoked' })
  async logout(@Body({ schema: refreshSchema }) body: RefreshInput) {
    await this.auth.logout(body.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiResponse({ status: 200, standardSchema: userSchema })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
