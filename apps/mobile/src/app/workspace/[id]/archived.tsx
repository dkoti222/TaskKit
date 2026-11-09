import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage, getErrorStatus } from '@/api/errors';
import { AccessRemoved } from '@/components/access-removed';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { useRestoreBoard } from '@/hooks/use-board-mutations';
import { useBoards } from '@/hooks/use-boards';
import { shortDate } from '@/lib/format';
import { canManageBoard } from '@/lib/roles';
import { colors, fonts, radius, spacing } from '@/theme';

// 18 · Archived items — archived boards for now. The design's Cards / Lists tabs come with those APIs.
export default function ArchivedItemsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const archived = useBoards(id, true);
  const restore = useRestoreBoard(id);

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace({ pathname: '/workspace/[id]', params: { id } });

  if (getErrorStatus(archived.error) === 404) {
    return (
      <AccessRemoved
        title="You don’t have access to this workspace"
        message="You may have been removed, or the workspace was deleted."
        primary={{ title: 'Go to all workspaces', onPress: () => router.dismissTo('/') }}
      />
    );
  }

  const boards = archived.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <NavHeader title="Archived items" onBack={goBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={archived.isRefetching}
            onRefresh={() => void archived.refetch()}
            tintColor={colors.primary}
          />
        }>
        {archived.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : archived.isError ? (
          <View style={styles.card}>
            <FormMessage message={getErrorMessage(archived.error)} />
            <Button title="Try again" variant="secondary" onPress={() => archived.refetch()} />
          </View>
        ) : (
          <>
            <View style={styles.tabs}>
              <View style={styles.tabOn}>
                <Text style={styles.tabText}>Boards · {boards.length}</Text>
              </View>
            </View>

            <View style={[styles.card, styles.list]}>
              {boards.length === 0 ? (
                <AppText variant="small" style={styles.empty}>
                  No archived boards.
                </AppText>
              ) : (
                boards.map((board, index) => {
                  const busy = restore.isPending && restore.variables === board.id;
                  return (
                    <View key={board.id} style={[styles.row, index > 0 && styles.divider]}>
                      <View style={[styles.dot, { backgroundColor: board.color }]} />
                      <View style={styles.flex}>
                        <AppText style={styles.name} numberOfLines={1}>
                          {board.name}
                        </AppText>
                        <AppText variant="small" numberOfLines={1}>
                          {board.visibility === 'PRIVATE' ? 'Private board' : 'Board'}
                          {board.archivedAt ? ` · archived ${shortDate(board.archivedAt)}` : ''}
                        </AppText>
                      </View>
                      {canManageBoard(board.role) ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Restore ${board.name}`}
                          disabled={restore.isPending}
                          onPress={() => restore.mutate(board.id)}
                          style={({ pressed }) => [styles.restore, pressed && styles.pressed]}>
                          {busy ? (
                            <ActivityIndicator size="small" color={colors.ink} />
                          ) : (
                            <Text style={styles.restoreText}>Restore</Text>
                          )}
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
            <FormMessage message={restore.isError ? getErrorMessage(restore.error) : null} />

            <View style={[styles.card, styles.note]}>
              <Feather name="archive" size={16} color={colors.muted} style={styles.noteIcon} />
              <AppText variant="small" style={styles.flex}>
                Archived boards stay hidden from the workspace until restored. Board Owners and
                Admins can restore them.
              </AppText>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  loading: { marginTop: spacing.xxl },
  flex: { flex: 1 },
  tabs: { flexDirection: 'row', padding: 3, borderRadius: radius.control, backgroundColor: '#E9EBEF' },
  tabOn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  list: { paddingVertical: 0, paddingHorizontal: spacing.md, gap: 0 },
  empty: { paddingVertical: spacing.lg, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  dot: { width: 12, height: 12, borderRadius: 3 },
  name: { fontFamily: fonts.medium, fontSize: 15 },
  restore: {
    minWidth: 76,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.background },
  restoreText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  note: { flexDirection: 'row', gap: spacing.md },
  noteIcon: { marginTop: 1 },
});
