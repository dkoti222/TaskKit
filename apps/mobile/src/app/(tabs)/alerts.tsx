import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/errors';
import type { AppNotification } from '@/api/types';
import { declineInvitation } from '@/api/workspaces';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { RealtimeBanner } from '@/components/realtime-banner';
import { MemberAvatar, WorkspaceTile } from '@/components/workspace-ui';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '@/hooks/use-notifications';
import { dayLabel, firstName, timeAgo } from '@/lib/format';
import { colors, fonts, radius, spacing } from '@/theme';

type Filter = 'all' | 'unread' | 'mentions';

// 19 · Notifications: assignments, mentions, comments on your cards, due reminders and
// invitations. Unread ones have a dot; tapping one marks it read and opens the card.
export default function AlertsScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const list = useNotifications(filter === 'unread');
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const sections = useMemo(() => {
    let items = list.data?.pages.flatMap((p) => p.items) ?? [];
    if (filter === 'mentions') items = items.filter((n) => n.type === 'comment.mentioned');
    const groups: { title: string; data: AppNotification[] }[] = [];
    for (const n of items) {
      const title = dayLabel(n.createdAt);
      const last = groups[groups.length - 1];
      if (last?.title === title) last.data.push(n);
      else groups.push({ title, data: [n] });
    }
    return groups;
  }, [list.data, filter]);

  const open = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.type === 'workspace.invited' && n.data.invitationToken) {
      router.push({ pathname: '/invite/[token]', params: { token: n.data.invitationToken } });
    } else if (n.data.boardId && n.data.cardId) {
      router.push({
        pathname: '/board/[id]/card/[cardId]',
        params: { id: n.data.boardId, cardId: n.data.cardId },
      });
    }
  };

  const count = unread.data ?? 0;
  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: count ? `Unread · ${count}` : 'Unread' },
    { key: 'mentions', label: 'Mentions' },
  ];

  const empty = list.isPending ? (
    <ActivityIndicator color={colors.primary} style={styles.loading} />
  ) : list.isError ? (
    <View style={styles.message}>
      <Feather name="wifi-off" size={22} color={colors.muted} />
      <AppText variant="secondary" style={styles.center}>
        {getErrorMessage(list.error)}
      </AppText>
      <Button title="Try again" variant="secondary" onPress={() => list.refetch()} />
    </View>
  ) : (
    <View style={styles.message}>
      <Feather name="bell" size={22} color={colors.muted} />
      <AppText variant="secondary" style={styles.center}>
        {filter === 'unread'
          ? 'You’re all caught up.'
          : filter === 'mentions'
            ? 'Nobody has mentioned you yet.'
            : 'No notifications yet. You’ll hear about cards assigned to you, mentions, comments and due dates here.'}
      </AppText>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Notifications
        </AppText>
        {count > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => markAll.mutate()}
            disabled={markAll.isPending}
            hitSlop={10}
            style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.link}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.chips} accessibilityRole="tablist">
        {chips.map((c) => {
          const on = c.key === filter;
          return (
            <Pressable
              key={c.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(c.key)}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <RealtimeBanner />
      <SectionList
        sections={sections}
        keyExtractor={(n) => n.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <AppText variant="small" style={styles.day} accessibilityRole="header">
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => (
          <NotificationRow
            n={item}
            onPress={() => open(item)}
            onDecline={() => {
              const token = item.data.invitationToken;
              if (token) void declineInvitation(token).catch(() => undefined);
              markRead.mutate(item.id);
            }}
          />
        )}
        ListEmptyComponent={empty}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} style={styles.more} />
          ) : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => {
              void list.refetch();
              void unread.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

/** "today at 6:00 PM", "tomorrow at 9:00 AM", or "Nov 4 at 6:00 PM". */
function dueWhen(iso: string) {
  const due = new Date(iso);
  const time = due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = dayLabel(iso);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (day === 'Today') return `today at ${time}`;
  if (due.toDateString() === tomorrow.toDateString()) return `tomorrow at ${time}`;
  return `${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${time}`;
}

function NotificationRow({
  n,
  onPress,
  onDecline,
}: {
  n: AppNotification;
  onPress: () => void;
  onDecline: () => void;
}) {
  const d = n.data;
  const who = d.actorName ? firstName(d.actorName) : 'Someone';
  const card = d.cardTitle ?? 'a card';
  const unread = !n.readAt;

  const sentence: { text: string; strong?: boolean }[] =
    n.type === 'card.assigned'
      ? [{ text: who, strong: true }, { text: ' assigned you to ' }, { text: card, strong: true }]
      : n.type === 'comment.mentioned'
        ? [
            { text: who, strong: true },
            { text: ' mentioned you in ' },
            { text: card, strong: true },
          ]
        : n.type === 'comment.created'
          ? [{ text: who, strong: true }, { text: ' commented on ' }, { text: card, strong: true }]
          : n.type === 'workspace.invited'
            ? [
                { text: who, strong: true },
                { text: ' invited you to ' },
                { text: d.workspaceName ?? 'a workspace', strong: true },
              ]
            : [
                { text: card, strong: true },
                { text: ` is due ${d.dueAt ? dueWhen(d.dueAt) : 'soon'}` },
              ];

  const meta = [d.boardName, timeAgo(n.createdAt)].filter(Boolean).join(' · ');
  const a11y = `${unread ? 'Unread. ' : ''}${sentence.map((p) => p.text).join('')}. ${meta}`;

  let icon;
  if (n.type === 'card.due') {
    icon = (
      <View style={styles.dueIcon}>
        <Feather name="clock" size={16} color="#B5561A" />
      </View>
    );
  } else if (n.type === 'workspace.invited') {
    icon = <WorkspaceTile name={d.workspaceName ?? '?'} seed={d.workspaceId ?? ''} size={32} />;
  } else {
    icon = <MemberAvatar name={d.actorName ?? '?'} seed={d.actorId ?? ''} size={32} />;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && styles.pressed]}>
      {icon}
      <View style={styles.flex}>
        <Text style={styles.sentence}>
          {sentence.map((p, i) => (
            <Text key={i} style={p.strong ? styles.strong : undefined}>
              {p.text}
            </Text>
          ))}
        </Text>
        {d.preview && (n.type === 'comment.mentioned' || n.type === 'comment.created') ? (
          <View style={styles.preview}>
            <Text style={styles.previewText} numberOfLines={3}>
              {d.preview}
            </Text>
          </View>
        ) : null}
        <Text style={styles.meta}>{meta}</Text>
        {n.type === 'workspace.invited' && unread ? (
          <View style={styles.inviteActions}>
            <Button title="Accept" onPress={onPress} style={styles.smallButton} />
            <Button
              title="Decline"
              variant="secondary"
              onPress={onDecline}
              style={styles.smallButton}
            />
          </View>
        ) : null}
      </View>
      {unread ? <View style={styles.dot} accessibilityElementsHidden /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  link: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  chipTextOn: { color: colors.surface },
  list: { paddingBottom: spacing.xxl, flexGrow: 1 },
  day: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowUnread: { backgroundColor: '#F3F6FE' },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  sentence: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  strong: { fontFamily: fonts.semibold },
  preview: {
    marginTop: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  previewText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  dueIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDEEE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  smallButton: { minHeight: 44, height: 44, paddingHorizontal: spacing.lg },
  loading: { marginTop: spacing.xxl },
  more: { marginVertical: spacing.lg },
  message: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  center: { textAlign: 'center' },
});
