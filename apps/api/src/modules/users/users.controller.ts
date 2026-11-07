import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { toPublicUser } from './user.mapper';
import { UpdateMeDto } from './update-me.dto';
import { DeleteMeDto } from './delete-me.dto'
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

  @Patch()
  async update(@CurrentUser() current: AuthUser, @Body() dto: UpdateMeDto) {
    const user = await this.users.update(current.id, dto);
    return toPublicUser(user);
  }

  @Delete()
  @HttpCode(200)
  async remove(@CurrentUser() current: AuthUser, @Body() dto: DeleteMeDto) {
    await this.users.deleteAccount(current.id, dto.password);
    return { message: 'Your account has been deleted.' };
  }
}