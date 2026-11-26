import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import {
  getNotificationSettings,
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
  updateNotificationSettings,
} from '@/api/notifications';
import type { AppNotification, NotificationSettings, Page } from '@/api/types';
import { useSession } from '@/store/session';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unread: boolean) => [...notificationKeys.all, 'list', unread ? 'unread' : 'all'] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
  settings: () => [...notificationKeys.all, 'settings'] as const,
};

type Pages = InfiniteData<Page<AppNotification>, string | null>;

/** 19 · Notifications, newest first, page by page. */
export function useNotifications(unread: boolean) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(unread),
    queryFn: ({ pageParam }) => listNotifications(unread, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** For the Alerts tab badge. Live updates come from the socket (notification:new). */
export function useUnreadCount() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: getUnreadCount,
    enabled: signedIn,
  });
}

/** Marks one as read straight away in every cached list, then tells the API. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markRead(id),
    onMutate: (id) => {
      const now = new Date().toISOString();
      let changed = false;
      queryClient.setQueriesData<Pages>({ queryKey: [...notificationKeys.all, 'list'] }, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((n) => {
                  if (n.id !== id || n.readAt) return n;
                  changed = true;
                  return { ...n, readAt: now };
                }),
              })),
            }
          : old,
      );
      if (changed) {
        queryClient.setQueryData<number>(notificationKeys.unreadCount(), (c) =>
          c ? Math.max(0, c - 1) : c,
        );
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      queryClient.setQueryData(notificationKeys.unreadCount(), 0);
      return queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useNotificationSettings() {
  return useQuery({ queryKey: notificationKeys.settings(), queryFn: getNotificationSettings });
}

/** Ticks change straight away; a failure puts them back. */
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  const key = notificationKeys.settings();
  return useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) => updateNotificationSettings(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationSettings>(key);
      if (previous) queryClient.setQueryData(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (_e, _p, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (settings) => queryClient.setQueryData(key, settings),
  });
}
