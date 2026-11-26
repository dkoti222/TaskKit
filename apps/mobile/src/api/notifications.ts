import { api } from './client';
import type { AppNotification, NotificationSettings, Page } from './types';

// Everything here is the logged-in user's own data.

export async function listNotifications(unread: boolean, cursor?: string | null) {
  const { data } = await api.get<Page<AppNotification>>('/notifications', {
    params: { unread: unread || undefined, cursor: cursor ?? undefined, limit: 20 },
  });
  return data;
}

export async function getUnreadCount() {
  const { data } = await api.get<{ count: number }>('/notifications/unread-count');
  return data.count;
}

export async function markRead(id: string) {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllRead() {
  await api.post('/notifications/read-all');
}

export async function savePushToken(token: string, platform: 'ios' | 'android' | 'web') {
  await api.post('/me/push-tokens', { token, platform });
}

export async function deletePushToken(token: string) {
  await api.delete(`/me/push-tokens/${encodeURIComponent(token)}`, { timeout: 5_000 });
}

export async function getNotificationSettings() {
  const { data } = await api.get<NotificationSettings>('/me/notification-settings');
  return data;
}

export async function updateNotificationSettings(patch: Partial<NotificationSettings>) {
  const { data } = await api.patch<NotificationSettings>('/me/notification-settings', patch);
  return data;
}
