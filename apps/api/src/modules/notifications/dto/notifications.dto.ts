import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
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

  /** How long before a due date to remind: 1–72 hours. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(72)
  reminderHoursBefore?: number;
}
