import { BadRequestException, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './decorators/current-user.decorator';
import { TokenService } from './token.service';

/** Screen 22: the devices you're signed in on, and "Log out of other devices". Your own only. */
@ApiTags('sessions')
@ApiBearerAuth()
@Controller('me/sessions')
export class SessionsController {
  constructor(private readonly tokens: TokenService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tokens.listSessions(user.id, user.sessionId);
  }

  @Post('logout-others')
  @HttpCode(200)
  async logoutOthers(@CurrentUser() user: AuthUser) {
    // Tokens from before sessions existed don't say which device they are; refreshing fixes it.
    if (!user.sessionId) throw new BadRequestException('Log in again to manage your devices');
    const count = await this.tokens.revokeOtherSessions(user.id, user.sessionId);
    return { message: count ? `Logged out of ${count} other device${count === 1 ? '' : 's'}` : 'No other devices', count };
  }
}
