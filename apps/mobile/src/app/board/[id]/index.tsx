import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/errors';
import { AppText } from '@/components/app-text';
import { BoardAccessRemoved, useBoardAccessLost } from '@/components/board-access';
import { Button } from '@/components/button';
import { IconButton } from '@/components/misc';
import { findCachedBoard, useBoard } from '@/hooks/use-boards';
import { useWorkspace } from '@/hooks/use-workspaces';
import { colors, fonts, spacing } from '@/theme';

// Board screen placeholder: header in the board colour (as in 29/30). Lists and cards come later.
export default function BoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const board = useBoard(id);
  // Remember where the board lives, for the Access removed screen after a 404.
  const [cached] = useState(() => findCachedBoard(queryClient, id));
  const workspaceId = board.data?.workspaceId ?? cached?.workspaceId ?? '';
  const workspace = useWorkspace(workspaceId);
  const lost = useBoardAccessLost(board.error, workspaceId);

  const goBack = () =>
    router.canGoBack()
      ? router.back()
      : workspaceId
        ? router.replace({ pathname: '/workspace/[id]', params: { id: workspaceId } })
        : router.replace('/');

  if (lost) {
    return <BoardAccessRemoved boardName={cached?.name} workspaceId={workspaceId} />;
  }

  const color = board.data?.color ?? colors.primary;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={{ backgroundColor: color }}>
        <View style={styles.header}>
          <IconButton icon="chevron-left" label="Go back" onPress={goBack} color={colors.surface} />
          <View style={styles.titleBox}>
            <AppText style={styles.title} numberOfLines={1} accessibilityRole="header">
              {board.data?.name ?? ''}
            </AppText>
            {workspace.data ? (
              <AppText style={styles.subtitle} numberOfLines={1}>
                {workspace.data.name}
              </AppText>
            ) : null}
          </View>
          {board.data?.visibility === 'PRIVATE' ? (
            <Feather name="lock" size={16} color={colors.surface} style={styles.lock} />
          ) : null}
          {board.data ? (
            <IconButton
              icon="settings"
              label="Board settings"
              onPress={() => router.push({ pathname: '/board/[id]/settings', params: { id } })}
              color={colors.surface}
            />
          ) : null}
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={board.isRefetching && !board.isPlaceholderData}
            onRefresh={() => void board.refetch()}
            tintColor={colors.primary}
          />
        }>
        {board.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : board.isError && !board.data ? (
          <View style={styles.card}>
            <AppText variant="secondary" style={{ color: colors.danger }}>
              {getErrorMessage(board.error)}
            </AppText>
            <Button title="Try again" variant="secondary" onPress={() => board.refetch()} />
          </View>
        ) : (
          <View style={[styles.card, styles.placeholder]}>
            <View style={[styles.iconTile, { backgroundColor: `${color}1F` }]}>
              <Feather name="trello" size={22} color={color} />
            </View>
            <AppText variant="heading">Lists and cards are coming soon</AppText>
            <AppText variant="small" style={styles.center}>
              This is where the board{'’'}s lists and cards will show.
            </AppText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    minHeight: 56,
  },
  titleBox: { flex: 1, marginLeft: spacing.xs },
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.surface },
  subtitle: { fontSize: 12, lineHeight: 16, color: colors.surface, opacity: 0.85 },
  lock: { marginHorizontal: spacing.xs },
  content: { flexGrow: 1, padding: spacing.lg },
  loading: { marginTop: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  placeholder: { alignItems: 'center', paddingVertical: spacing.xl },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  center: { textAlign: 'center' },
});
