import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
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
import type { ActivityItem, ActivityKind } from '@/api/types';
import { BoardActivityRow } from '@/components/activity-ui';
import { AppText } from '@/components/app-text';
import { BoardAccessRemoved, useBoardAccessLost } from '@/components/board-access';
import { Button } from '@/components/button';
import { NavHeader } from '@/components/nav-header';
import { RealtimeBanner } from '@/components/realtime-banner';
import { useBoardActivity } from '@/hooks/use-activity';
import { useBoardRoom } from '@/hooks/use-board-room';
import { findCachedBoard, useBoard } from '@/hooks/use-boards';
import { useMe } from '@/hooks/use-me';
import { dayLabel } from '@/lib/format';
import { colors, fonts, spacing } from '@/theme';

const KINDS: { kind: ActivityKind; label: string }[] = [
  { kind: 'all', label: 'Everything' },
  { kind: 'cards', label: 'Cards' },
  { kind: 'members', label: 'Members' },
];

// 20 · Board activity: everything that happened on the board, newest first, grouped by day.
// More pages load as you scroll; new entries arrive live through the board's socket room.
export default function BoardActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ActivityKind>('all');
  const me = useMe();
  const board = useBoard(id);
  const [cached] = useState(() => findCachedBoard(queryClient, id));
  const activity = useBoardActivity(id, kind);
  const lost = useBoardAccessLost(activity.error ?? board.error, board.data?.workspaceId);
  useBoardRoom(lost ? undefined : id);

  const sections = useMemo(() => {
    const groups: { title: string; data: ActivityItem[] }[] = [];
    for (const item of activity.data?.pages.flatMap((p) => p.items) ?? []) {
      const title = dayLabel(item.createdAt);
      const last = groups[groups.length - 1];
      if (last?.title === title) last.data.push(item);
      else groups.push({ title, data: [item] });
    }
    return groups;
  }, [activity.data]);

  const goBack = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/board/[id]', params: { id } });

  if (lost) {
    return (
      <BoardAccessRemoved
        boardName={board.data?.name ?? cached?.name}
        workspaceId={board.data?.workspaceId ?? cached?.workspaceId}
      />
    );
  }

  const empty = activity.isPending ? (
    <ActivityIndicator color={colors.primary} style={styles.loading} />
  ) : activity.isError ? (
    <View style={styles.message}>
      <Feather name="wifi-off" size={22} color={colors.muted} />
      <AppText variant="secondary" style={styles.center}>
        {getErrorMessage(activity.error)}
      </AppText>
      <Button title="Try again" variant="secondary" onPress={() => activity.refetch()} />
    </View>
  ) : (
    <View style={styles.message}>
      <Feather name="clock" size={22} color={colors.muted} />
      <AppText variant="secondary" style={styles.center}>
        {kind === 'members'
          ? 'No member changes yet.'
          : kind === 'cards'
            ? 'No card activity yet.'
            : 'Nothing has happened on this board yet.'}
      </AppText>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <NavHeader title="Activity" subtitle={board.data?.name ?? cached?.name} onBack={goBack} />
      <RealtimeBanner />
      <View style={styles.chips} accessibilityRole="tablist">
        {KINDS.map((k) => {
          const selected = k.kind === kind;
          return (
            <Pressable
              key={k.kind}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setKind(k.kind)}
              style={[styles.chip, selected && styles.chipOn]}>
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{k.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <AppText variant="small" style={styles.day} accessibilityRole="header">
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => (
          <BoardActivityRow
            item={item}
            meId={me.data?.id}
            onPress={
              item.cardId
                ? () =>
                    router.push({
                      pathname: '/board/[id]/card/[cardId]',
                      params: { id, cardId: item.cardId! },
                    })
                : undefined
            }
          />
        )}
        ListEmptyComponent={empty}
        onEndReached={() => {
          if (activity.hasNextPage && !activity.isFetchingNextPage) void activity.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          activity.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} style={styles.more} />
          ) : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={activity.isRefetching && !activity.isFetchingNextPage}
            onRefresh={() => void activity.refetch()}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  day: { marginTop: spacing.lg, marginBottom: spacing.xs },
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
