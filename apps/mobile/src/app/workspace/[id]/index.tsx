import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage, getErrorStatus } from '@/api/errors';
import type { Member, Workspace } from '@/api/types';
import { AccessRemoved } from '@/components/access-removed';
import { AppText } from '@/components/app-text';
import { BoardCard, NewBoardTile } from '@/components/board-ui';
import { Button } from '@/components/button';
import { IconButton } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { MemberAvatar, RoleBadge } from '@/components/workspace-ui';
import { useBoards } from '@/hooks/use-boards';
import { useMembers, useWorkspace } from '@/hooks/use-workspaces';
import { plural } from '@/lib/format';
import { canCreateBoard } from '@/lib/roles';
import { colors, fonts, radius, spacing } from '@/theme';

const GRID_GAP = 12;

// 08 · Workspace boards. "Recent activity" from the design is left out: there's no activity API yet.
export default function WorkspaceBoardsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspace = useWorkspace(id);
  const members = useMembers(id);
  const boards = useBoards(id);
  const archived = useBoards(id, true);
  const { width } = useWindowDimensions();
  const tileWidth = (width - spacing.lg * 2 - GRID_GAP) / 2;

  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openMembers = () => router.push({ pathname: '/workspace/[id]/members', params: { id } });
  const openSettings = () => router.push({ pathname: '/workspace/[id]/settings', params: { id } });
  const newBoard = () => router.push({ pathname: '/workspace/[id]/new-board', params: { id } });
  const openBoard = (boardId: string) =>
    router.push({ pathname: '/board/[id]', params: { id: boardId } });

  // 404 = not a member of this workspace (removed, or it was deleted).
  if (getErrorStatus(workspace.error) === 404 || getErrorStatus(boards.error) === 404) {
    return (
      <AccessRemoved
        title={
          workspace.data
            ? `You no longer have access to ${workspace.data.name}`
            : 'You don’t have access to this workspace'
        }
        message="You may have been removed, or the workspace was deleted."
        primary={{ title: 'Go to all workspaces', onPress: () => router.replace('/') }}
      />
    );
  }

  const ws = workspace.data;
  const canCreate = canCreateBoard(ws?.role);
  const error = workspace.error ?? boards.error;
  const boardList = boards.data ?? [];

  const onRefresh = () => {
    void workspace.refetch();
    void members.refetch();
    void boards.refetch();
    void archived.refetch();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <NavHeader
        title={ws?.name ?? 'Workspace'}
        onBack={goHome}
        right={
          ws ? (
            <View style={styles.headerIcons}>
              <IconButton icon="settings" label="Workspace settings" onPress={openSettings} />
              <IconButton icon="users" label="Members" onPress={openMembers} />
            </View>
          ) : null
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={workspace.isRefetching || boards.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }>
        {workspace.isPending || boards.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : error ? (
          <View style={styles.errorCard}>
            <AppText variant="secondary" style={{ color: colors.danger }}>
              {getErrorMessage(error)}
            </AppText>
            <Button title="Try again" variant="secondary" onPress={onRefresh} />
          </View>
        ) : (
          <>
            <View style={styles.topRow}>
              <MemberStack members={members.data} workspace={ws!} onPress={openMembers} />
              <RoleBadge role={ws!.role} prefix="You're" />
            </View>

            {boardList.length === 0 ? (
              <EmptyBoards canCreate={canCreate} onCreate={newBoard} />
            ) : (
              <>
                <View style={styles.sectionRow}>
                  <AppText style={styles.sectionTitle} accessibilityRole="header">
                    Boards
                  </AppText>
                  <AppText variant="small">{plural(boardList.length, 'board')}</AppText>
                </View>
                <View style={styles.grid}>
                  {boardList.map((board) => (
                    <BoardCard
                      key={board.id}
                      board={board}
                      width={tileWidth}
                      onPress={() => openBoard(board.id)}
                    />
                  ))}
                  {canCreate ? <NewBoardTile width={tileWidth} onPress={newBoard} /> : null}
                </View>
              </>
            )}

            {archived.data?.length ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: '/workspace/[id]/archived', params: { id } })
                }
                style={({ pressed }) => [styles.archivedRow, pressed && styles.pressedRow]}>
                <Feather name="archive" size={18} color={colors.ink} />
                <AppText style={styles.archivedText}>Archived items</AppText>
                <AppText variant="small">{archived.data.length}</AppText>
                <Feather name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** "RK SA JD +5" — overlapping initials of the first members; opens Members. */
function MemberStack({
  members,
  workspace,
  onPress,
}: {
  members: Member[] | undefined;
  workspace: Workspace;
  onPress: () => void;
}) {
  const shown = (members ?? []).slice(0, 3);
  const extra = workspace.memberCount - shown.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${plural(workspace.memberCount, 'member')}. Open members`}
      onPress={onPress}
      hitSlop={8}
      style={styles.stack}>
      {shown.map((m, i) => (
        <View key={m.userId} style={[styles.stackItem, i > 0 && styles.stackOverlap]}>
          <MemberAvatar name={m.name} seed={m.userId} size={26} />
        </View>
      ))}
      {extra > 0 ? (
        <AppText variant="small" style={styles.stackMore}>
          +{extra}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** Empty state for a workspace with no boards (styled like 28/29). */
function EmptyBoards({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name="trello" size={24} color={colors.primary} />
      </View>
      <AppText variant="heading" style={styles.centerText}>
        Create your first board
      </AppText>
      <AppText variant="secondary" style={[styles.centerText, styles.emptyText]}>
        {canCreate
          ? 'Boards hold the lists and cards your team works on, like a project or a team process.'
          : 'There are no boards you can see yet. An Owner, Admin or Member can create one.'}
      </AppText>
      {canCreate ? (
        <Button title="Create board" icon="plus" onPress={onCreate} style={styles.stretch} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerIcons: { flexDirection: 'row' },
  content: { flexGrow: 1, padding: spacing.lg, gap: spacing.md },
  loading: { marginTop: spacing.xxl },
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stack: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  stackItem: { borderRadius: 15, borderWidth: 2, borderColor: colors.background },
  stackOverlap: { marginLeft: -8 },
  stackMore: { marginLeft: 6, fontFamily: fonts.medium },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  centerText: { textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 21 },
  stretch: { alignSelf: 'stretch', marginTop: spacing.md },
  archivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  archivedText: { flex: 1, fontSize: 15 },
  pressedRow: { backgroundColor: '#EEF0F4' },
});
