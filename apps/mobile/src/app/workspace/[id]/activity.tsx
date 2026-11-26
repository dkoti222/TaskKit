import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/errors';
import type { ActivityItem } from '@/api/types';
import { BoardActivityRow } from '@/components/activity-ui';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { NavHeader } from '@/components/nav-header';
import { useWorkspaceActivity } from '@/hooks/use-activity';
import { useMe } from '@/hooks/use-me';
import { useWorkspace } from '@/hooks/use-workspaces';
import { dayLabel } from '@/lib/format';
import { colors, spacing } from '@/theme';

// "See all" from 08: everything that happened on the workspace's boards you can see, newest first.
export default function WorkspaceActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspace = useWorkspace(id);
  const activity = useWorkspaceActivity(id);
  const me = useMe();

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
      : router.replace({ pathname: '/workspace/[id]', params: { id } });

  const empty = activity.isPending ? (
    <ActivityIndicator color={colors.primary} style={styles.loading} />
  ) : activity.isError ? (
    <View style={styles.message}>
      <AppText variant="secondary" style={styles.center}>
        {getErrorMessage(activity.error)}
      </AppText>
      <Button title="Try again" variant="secondary" onPress={() => activity.refetch()} />
    </View>
  ) : (
    <View style={styles.message}>
      <Feather name="clock" size={22} color={colors.muted} />
      <AppText variant="secondary" style={styles.center}>
        Nothing has happened on these boards yet.
      </AppText>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <NavHeader title="Activity" subtitle={workspace.data?.name} onBack={goBack} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <AppText variant="small" style={styles.day} accessibilityRole="header">
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => (
          <BoardActivityRow
            item={item}
            meId={me.data?.id}
            showBoard
            onPress={() =>
              item.cardId
                ? router.push({
                    pathname: '/board/[id]/card/[cardId]',
                    params: { id: item.boardId, cardId: item.cardId },
                  })
                : router.push({ pathname: '/board/[id]', params: { id: item.boardId } })
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
