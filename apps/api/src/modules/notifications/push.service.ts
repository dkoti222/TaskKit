import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../../prisma/prisma.service';

export type PushMessage = {
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

/**
 * Sends Expo push notifications. Expo forwards them to Apple (APNs) and Google (FCM), so we only
 * need the device's Expo push token. Messages go out in chunks of up to 100 (Expo's limit).
 * Tokens Expo reports as DeviceNotRegistered (app uninstalled, token expired) are deleted.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo: Expo;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    // Optional: only needed if "enhanced push security" is turned on in the Expo project.
    this.expo = new Expo({ accessToken: config.get<string>('EXPO_ACCESS_TOKEN') || undefined });
  }

  async send(messages: PushMessage[]) {
    if (messages.length === 0) return;
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: [...new Set(messages.map((m) => m.userId))] } },
      select: { token: true, userId: true },
    });

    const out: ExpoPushMessage[] = [];
    for (const m of messages) {
      for (const t of tokens.filter((t) => t.userId === m.userId)) {
        if (!Expo.isExpoPushToken(t.token)) continue;
        out.push({ to: t.token, title: m.title, body: m.body, data: m.data, sound: 'default' });
      }
    }
    if (out.length === 0) return;

    const dead = new Set<string>();
    for (const chunk of this.expo.chunkPushNotifications(out)) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, i) => {
          if (ticket.status === 'error') {
            if (ticket.details?.error === 'DeviceNotRegistered') dead.add(chunk[i].to as string);
            else this.logger.warn(`Push failed: ${ticket.message}`);
          }
        });
      } catch (error) {
        // Network trouble or Expo down: the in-app notification is already saved.
        this.logger.warn(`Couldn't reach Expo push: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (dead.size) {
      await this.prisma.pushToken.deleteMany({ where: { token: { in: [...dead] } } });
      this.logger.log(`Removed ${dead.size} invalid push token(s)`);
    }
  }
}
