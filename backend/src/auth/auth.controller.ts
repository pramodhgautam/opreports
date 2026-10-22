import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthUser, RequestWithUserContext, UserContext } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('whoami')
  whoami(
    @CurrentUser() user: AuthUser,
    @Req() request: RequestWithUserContext,
  ): Promise<UserContext> {
    return this.authService.resolveUserContext(user, request);
  }

  @Get('permissions')
  async permissions(
    @CurrentUser() user: AuthUser,
    @Req() request: RequestWithUserContext,
  ): Promise<{ permissions: string[] }> {
    const context = await this.authService.resolveUserContext(user, request);
    return { permissions: context.permissions };
  }
}
