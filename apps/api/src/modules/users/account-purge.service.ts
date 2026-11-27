import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

const PURGE_AFTER_DAYS = 30;

/**
 * PDF "Account deletion": deleting an account removes the profile, tokens and memberships at
 * once (UsersService.deleteAccount). 30 days later this daily job hard-deletes what personal data
 * is left. The user row itself stays, as "Deleted user", because cards, comments and activity
 * still point at it.
 */
@Injectable()
export class AccountPurgeService {
  private readonly logger = new Logger(AccountPurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeDeletedAccounts() {
    const before = new Date(Date.now() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const users = await this.prisma.user.findMany({
      where: { deletedAt: { lt: before }, purgedAt: null },
      select: { id: true },
    });
    for (const { id } of users) {
      await this.prisma.$transaction([
        this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
        this.prisma.pushToken.deleteMany({ where: { userId: id } }),
        this.prisma.notification.deleteMany({ where: { userId: id } }),
        this.prisma.emailVerification.deleteMany({ where: { userId: id } }),
        this.prisma.passwordReset.deleteMany({ where: { userId: id } }),
        this.prisma.dueReminder.deleteMany({ where: { userId: id } }),
        this.prisma.user.update({
          where: { id },
          data: {
            passwordHash: '',
            avatarUrl: null,
            timezone: 'UTC',
            notifyPush: false,
            notifyMentionEmail: false,
            notifyDueReminders: false,
            purgedAt: new Date(),
          },
        }),
      ]);
    }
    if (users.length) this.logger.log(`Purged ${users.length} deleted account(s)`);
  }
}
