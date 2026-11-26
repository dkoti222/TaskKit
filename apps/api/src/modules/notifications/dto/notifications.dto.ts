import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PageQueryDto } from '../../../common/utils/pagination';

export class NotificationsQueryDto extends PageQueryDto {
  /** `?unread=true` → only unread ones. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unread?: boolean;
}

export class PushTokenDto {
  /** ExponentPushToken[…] from expo-notifications. */
  @IsString()
  @MinLength(10)
  @MaxLength(255)
  token!: string;

  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';
}

export class NotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsBoolean()
  mentionEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  dueReminders?: boolean;
}
