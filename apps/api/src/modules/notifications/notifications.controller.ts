import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  NotificationSettingsDto,
  NotificationsQueryDto,
  PushTokenDto,
} from './dto/notifications.dto';

// Everything here is about the logged-in user only: no roles, just your own data.

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Newest first. `?unread=true&cursor=&limit=20` */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: NotificationsQueryDto) {
    return this.notifications.list(user.id, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.id, id);
  }
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('me')
export class MeNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('push-tokens')
  @HttpCode(200)
  addToken(@CurrentUser() user: AuthUser, @Body() dto: PushTokenDto) {
    return this.notifications.addPushToken(user.id, dto.token, dto.platform);
  }

  /** The token goes in the path, URL-encoded (it contains [ and ]). */
  @Delete('push-tokens/:token')
  @HttpCode(200)
  removeToken(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.notifications.removePushToken(user.id, token);
  }

  @Get('notification-settings')
  settings(@CurrentUser() user: AuthUser) {
    return this.notifications.getSettings(user.id);
  }

  @Patch('notification-settings')
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: NotificationSettingsDto) {
    return this.notifications.updateSettings(user.id, dto);
  }
}
