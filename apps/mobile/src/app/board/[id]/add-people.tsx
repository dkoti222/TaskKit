import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import type { AssignableRole } from '@/api/types';
import { AppText } from '@/components/app-text';
import { BoardAccessRemoved, useBoardAccessLost } from '@/components/board-access';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { RoleOptions } from '@/components/role-picker';
import { Screen } from '@/components/screen';
import { MemberAvatar, RoleBadge } from '@/components/workspace-ui';
import { useAddBoardMembers } from '@/hooks/use-board-mutations';
import { findCachedBoard, useBoard, useBoardMembers } from '@/hooks/use-boards';
import { useMe } from '@/hooks/use-me';
import { useMembers } from '@/hooks/use-workspaces';
import { plural } from '@/lib/format';
import { BOARD_ROLE_DESCRIPTION, canManageBoard } from '@/lib/roles';
import { colors, fonts, radius, spacing } from '@/theme';

// Add people (from 17 · Board settings): pick workspace members who aren't on the board yet,
// choose one board role, then PUT /boards/:id/members/:userId for each.
// The workspace Owner and you are left out: the API refuses both.
export default function AddPeopleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const me = useMe();
  const board = useBoard(id);
  const [cached] = useState(() => findCachedBoard(queryClient, id));
  const workspaceId = board.data?.workspaceId ?? cached?.workspaceId ?? '';
  const wsMembers = useMembers(workspaceId);
  const boardMembers = useBoardMembers(id);
  const add = useAddBoardMembers(id);
  const lost = useBoardAccessLost(board.error, workspaceId);

  const [selected, setSelected] = useState<string[]>([]);
  const [role, setRole] = useState<AssignableRole>('MEMBER');
  const [query, setQuery] = useState('');

  const close = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/board/[id]/settings', params: { id } });

  const candidates = useMemo(() => {
    const onBoard = new Set((boardMembers.data ?? []).map((m) => m.userId));
    const q = query.trim().toLowerCase();
    return (wsMembers.data ?? []).filter(
      (m) =>
        m.role !== 'OWNER' &&
        m.userId !== me.data?.id &&
        !onBoard.has(m.userId) &&
        (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)),
    );
  }, [wsMembers.data, boardMembers.data, me.data?.id, query]);

  if (lost) {
    return <BoardAccessRemoved boardName={board.data?.name ?? cached?.name} workspaceId={workspaceId} />;
  }

  const toggle = (userId: string) =>
    setSelected((s) => (s.includes(userId) ? s.filter((x) => x !== userId) : [...s, userId]));

  const submit = () => {
    if (!selected.length || add.isPending) return;
    add.mutate({ userIds: selected, role }, { onSuccess: close });
  };

  const loading = wsMembers.isPending || boardMembers.isPending || board.isPending;
  const canManage = canManageBoard(board.data?.role);

  return (
    <Screen
      navHeader={<NavHeader title="Add people" onBack={close} backIcon="x" />}
      bottomBar={
        canManage ? (
          <Button
            title={selected.length ? `Add ${plural(selected.length, 'person', 'people')}` : 'Add to board'}
            onPress={submit}
            disabled={!selected.length}
            loading={add.isPending}
          />
        ) : undefined
      }>
      <View style={styles.top}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : !canManage ? (
          <FormMessage message="Only board Owners and Admins can add people." />
        ) : (
          <>
            <AppText variant="secondary">
              Only people in the workspace can be added.
              {board.data?.name ? ` They'll get this role on ${board.data.name}.` : ''}
            </AppText>

            <View style={styles.search}>
              <Feather name="search" size={18} color={colors.placeholder} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search workspace members"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search workspace members"
                style={styles.searchInput}
              />
            </View>

            <View style={styles.list}>
              {candidates.length === 0 ? (
                <AppText variant="small" style={styles.empty}>
                  {query
                    ? 'No one matches that search.'
                    : 'Everyone in the workspace is already on this board.'}
                </AppText>
              ) : (
                candidates.map((m, index) => {
                  const on = selected.includes(m.userId);
                  return (
                    <Pressable
                      key={m.userId}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${m.name}, ${m.email}`}
                      onPress={() => toggle(m.userId)}
                      style={({ pressed }) => [
                        styles.row,
                        index > 0 && styles.divider,
                        pressed && styles.pressed,
                      ]}>
                      <MemberAvatar name={m.name} seed={m.userId} size={34} />
                      <View style={styles.flex}>
                        <AppText style={styles.name} numberOfLines={1}>
                          {m.name}
                        </AppText>
                        <AppText variant="small" numberOfLines={1}>
                          {m.email}
                        </AppText>
                      </View>
                      <RoleBadge role={m.role} />
                      <View style={[styles.check, on && styles.checkOn]}>
                        {on ? <Feather name="check" size={14} color={colors.surface} /> : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>

            {candidates.length > 0 ? (
              <View style={styles.group}>
                <AppText variant="label">Board role</AppText>
                <RoleOptions
                  options={['ADMIN', 'MEMBER', 'VIEWER']}
                  value={role}
                  onChange={setRole}
                  descriptions={BOARD_ROLE_DESCRIPTION}
                />
              </View>
            ) : null}

            <FormMessage message={add.isError ? getErrorMessage(add.error) : null} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { gap: spacing.lg, marginTop: spacing.lg },
  loading: { marginTop: spacing.xxl },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.background,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  list: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.md,
  },
  empty: { paddingVertical: spacing.lg, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  pressed: { opacity: 0.7 },
  name: { fontFamily: fonts.medium, fontSize: 15 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  group: { gap: spacing.sm },
});
