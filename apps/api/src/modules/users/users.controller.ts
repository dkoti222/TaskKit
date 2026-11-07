import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { toPublicUser } from './user.mapper';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async me(@CurrentUser() current: AuthUser) {
    const user = await this.users.findById(current.id);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }
    return toPublicUser(user);
  }
}