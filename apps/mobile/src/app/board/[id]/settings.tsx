import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import type { BoardVisibility, Role } from '@/api/types';
import { AppText } from '@/components/app-text';
import { BoardAccessRemoved, useBoardAccessLost } from '@/components/board-access';
import { ColorSwatches, VisibilitySegment } from '@/components/board-ui';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { InfoNote } from '@/components/info-note';
import { FormMessage, TextLink } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { RoleDropdown, RoleSheet } from '@/components/role-picker';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { MemberAvatar, RoleBadge } from '@/components/workspace-ui';
import {
  useArchiveBoard,
  useRemoveBoardMember,
  useSetBoardRole,
  useUpdateBoard,
} from '@/hooks/use-board-mutations';
import { findCachedBoard, useBoard, useBoardMembers, useBoards } from '@/hooks/use-boards';
import { useMe } from '@/hooks/use-me';
import { useMembers } from '@/hooks/use-workspaces';
import { BOARD_ROLE_DESCRIPTION, canManageBoard } from '@/lib/roles';
import { colors, fonts, radius, spacing } from '@/theme';

type Row = {
  userId: string;
  name: string;
  role: Role;
  /** "Workspace owner" / "From workspace" / "Board override" */
  note: 'owner' | 'workspace' | 'override';
};

// 17 · Board settings. Everyone with access can open it; editing controls only show for
// board Owner / Admin. Everything in the top card is sent with one PATCH on Save.
export default function BoardSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const me = useMe();
  const board = useBoard(id);
  const [cached] = useState(() => findCachedBoard(queryClient, id));
  const workspaceId = board.data?.workspaceId ?? cached?.workspaceId ?? '';
  const wsMembers = useMembers(workspaceId);
  const boardMembers = useBoardMembers(id);
  const archived = useBoards(workspaceId, true);
  const lost = useBoardAccessLost(board.error ?? boardMembers.error, workspaceId);

  const update = useUpdateBoard(id, workspaceId);
  const archive = useArchiveBoard(workspaceId);
  const setRole = useSetBoardRole(id);
  const remove = useRemoveBoardMember(id);

  // null = not edited yet, so the field shows the saved value (and picks up refetches).
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<BoardVisibility | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<Row | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const b = board.data;
  const canManage = canManageBoard(b?.role);
  const nameValue = name ?? b?.name ?? '';
  const colorValue = color ?? b?.color ?? '#2F5BEA';
  const visibilityValue = visibility ?? b?.visibility ?? 'WORKSPACE';

  const changes = useMemo(() => {
    if (!b) return {};
    const body: { name?: string; color?: string; visibility?: BoardVisibility } = {};
    if (nameValue.trim() !== b.name) body.name = nameValue.trim();
    if (colorValue.toLowerCase() !== b.color.toLowerCase()) body.color = colorValue;
    if (visibilityValue !== b.visibility) body.visibility = visibilityValue;
    return body;
  }, [b, nameValue, colorValue, visibilityValue]);
  const dirty = Object.keys(changes).length > 0;

  // Workspace Owner first (always full access), then everyone added to the board.
  const rows = useMemo<Row[]>(() => {
    const wsRole = new Map((wsMembers.data ?? []).map((m) => [m.userId, m.role]));
    const owner = wsMembers.data?.find((m) => m.role === 'OWNER');
    const list: Row[] = owner
      ? [{ userId: owner.userId, name: owner.name, role: 'OWNER', note: 'owner' }]
      : [];
    for (const m of boardMembers.data ?? []) {
      if (m.userId === owner?.userId) continue;
      list.push({
        userId: m.userId,
        name: m.name,
        role: m.role,
        note: wsRole.get(m.userId) === m.role ? 'workspace' : 'override',
      });
    }
    return list;
  }, [wsMembers.data, boardMembers.data]);

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace({ pathname: '/board/[id]', params: { id } });

  if (lost) {
    return <BoardAccessRemoved boardName={b?.name ?? cached?.name} workspaceId={workspaceId} />;
  }

  const save = () => {
    if (!b || update.isPending || !dirty) return;
    if (changes.name !== undefined && changes.name.length < 2) {
      return setFormError('Board name must be at least 2 characters.');
    }
    setFormError(null);
    update.mutate(changes, {
      onSuccess: () => {
        setName(null);
        setColor(null);
        setVisibility(null);
      },
    });
  };

  const doArchive = () =>
    archive.mutate(id, {
      onSuccess: () => {
        setConfirmArchive(false);
        router.dismissTo({ pathname: '/workspace/[id]', params: { id: workspaceId } });
      },
    });

  const canChange = (row: Row) => canManage && row.note !== 'owner' && row.userId !== me.data?.id;
  const error = formError ?? (update.isError ? getErrorMessage(update.error) : null);
  const memberError = setRole.isError
    ? getErrorMessage(setRole.error)
    : remove.isError && !removing
      ? getErrorMessage(remove.error)
      : null;

  const saveButton = canManage ? (
    update.isPending ? (
      <ActivityIndicator color={colors.primary} />
    ) : (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !dirty }}
        disabled={!dirty}
        hitSlop={10}
        onPress={save}>
        <Text style={[styles.save, !dirty && styles.saveDisabled]}>Save</Text>
      </Pressable>
    )
  ) : null;

  return (
    <Screen
      background={colors.background}
      navHeader={<NavHeader title="Board settings" onBack={goBack} right={saveButton} />}>
      {board.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : !b ? (
        <View style={styles.top}>
          <FormMessage message={getErrorMessage(board.error)} />
          <Button title="Try again" variant="secondary" onPress={() => board.refetch()} />
        </View>
      ) : (
        <View style={styles.top}>
          {!canManage ? (
            <InfoNote icon="lock">Only board Owners and Admins can change these settings.</InfoNote>
          ) : null}

          <View style={styles.card}>
            <TextField
              label="Board name"
              value={nameValue}
              onChangeText={(t) => {
                setName(t);
                if (formError) setFormError(null);
              }}
              editable={canManage}
              maxLength={50}
              returnKeyType="done"
              onSubmitEditing={save}
              invalid={!!formError}
            />
            {canManage ? (
              <View style={styles.group}>
                <AppText variant="label">Background</AppText>
                <ColorSwatches value={colorValue} onChange={setColor} />
              </View>
            ) : null}
            <View style={styles.visibilityRow}>
              <AppText variant="label" style={styles.muted}>
                Visibility
              </AppText>
              {canManage ? (
                <VisibilitySegment value={visibilityValue} onChange={setVisibility} />
              ) : (
                <View style={styles.readOnly}>
                  {b.visibility === 'PRIVATE' ? (
                    <Feather name="lock" size={14} color={colors.muted} />
                  ) : null}
                  <AppText variant="label">
                    {b.visibility === 'PRIVATE' ? 'Private' : 'Workspace'}
                  </AppText>
                </View>
              )}
            </View>
            {canManage && visibilityValue === 'PRIVATE' && b.visibility !== 'PRIVATE' ? (
              <AppText variant="small">
                Only the workspace Owner and people in Board members will see it.
              </AppText>
            ) : null}
          </View>

          <FormMessage message={error} />

          <View style={styles.sectionRow}>
            <AppText style={styles.sectionTitle} accessibilityRole="header">
              Board members
            </AppText>
            {canManage ? (
              <TextLink
                title="Add people"
                inline
                onPress={() => router.push({ pathname: '/board/[id]/add-people', params: { id } })}
              />
            ) : null}
          </View>

          <View style={[styles.card, styles.list]}>
            {boardMembers.isPending || wsMembers.isPending ? (
              <ActivityIndicator color={colors.primary} style={styles.listLoading} />
            ) : (
              rows.map((row, index) => (
                <View key={row.userId} style={[styles.memberRow, index > 0 && styles.divider]}>
                  <MemberAvatar name={row.name} seed={row.userId} size={34} />
                  <View style={styles.flex}>
                    <AppText style={styles.memberName} numberOfLines={1}>
                      {row.name}
                      {row.userId === me.data?.id ? ' (you)' : ''}
                    </AppText>
                    <AppText
                      variant="small"
                      style={row.note === 'override' ? styles.override : undefined}>
                      {row.note === 'owner'
                        ? 'Workspace owner'
                        : row.note === 'workspace'
                          ? 'From workspace'
                          : 'Board override'}
                    </AppText>
                  </View>
                  {canChange(row) ? (
                    <RoleDropdown
                      role={row.role}
                      label={`${row.name}'s board role`}
                      onPress={() => setSheetFor(row)}
                    />
                  ) : (
                    <RoleBadge role={row.role} />
                  )}
                </View>
              ))
            )}
          </View>
          <FormMessage message={memberError} />

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/workspace/[id]/archived', params: { id: workspaceId } })
            }
            style={({ pressed }) => [styles.card, styles.linkRow, pressed && styles.pressed]}>
            <Feather name="archive" size={18} color={colors.ink} />
            <AppText style={styles.linkText}>Archived items</AppText>
            {archived.data ? <AppText variant="small">{archived.data.length}</AppText> : null}
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>

          {canManage ? (
            <Button
              title="Archive board"
              variant="dangerOutline"
              onPress={() => {
                archive.reset();
                setConfirmArchive(true);
              }}
            />
          ) : null}
        </View>
      )}

      <RoleSheet
        visible={!!sheetFor}
        title={sheetFor ? `${sheetFor.name}'s board role` : ''}
        current={sheetFor?.role ?? 'MEMBER'}
        options={['ADMIN', 'MEMBER', 'VIEWER']}
        descriptions={BOARD_ROLE_DESCRIPTION}
        removeLabel="Remove from board"
        onSelect={(role) => {
          const row = sheetFor;
          setSheetFor(null);
          if (row && role !== row.role) setRole.mutate({ userId: row.userId, role });
        }}
        onRemove={() => {
          remove.reset();
          setRemoving(sheetFor);
          setSheetFor(null);
        }}
        onClose={() => setSheetFor(null)}
      />

      <ConfirmDialog
        visible={!!removing}
        icon="user-x"
        title={`Remove ${removing?.name ?? ''} from this board?`}
        message={
          b?.visibility === 'PRIVATE'
            ? 'They will lose access to this private board. You can add them again later.'
            : 'This removes their board role. They can still open the board with their workspace role.'
        }
        confirmLabel="Remove"
        loading={remove.isPending}
        error={remove.isError ? getErrorMessage(remove.error) : null}
        onConfirm={() =>
          removing && remove.mutate(removing.userId, { onSuccess: () => setRemoving(null) })
        }
        onCancel={() => setRemoving(null)}
      />

      <ConfirmDialog
        visible={confirmArchive}
        icon="archive"
        title={`Archive ${b?.name ?? 'this board'}?`}
        message="The board will be hidden from the workspace for everyone. Board Owners and Admins can restore it from Archived items."
        confirmLabel="Archive board"
        loading={archive.isPending}
        error={archive.isError ? getErrorMessage(archive.error) : null}
        onConfirm={doArchive}
        onCancel={() => setConfirmArchive(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginTop: spacing.xxl },
  top: { gap: spacing.lg, marginTop: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  group: { gap: spacing.sm },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { color: colors.muted },
  readOnly: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  save: { fontFamily: fonts.semibold, fontSize: 16, color: colors.primary },
  saveDisabled: { color: colors.placeholder },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -spacing.sm,
  },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 15 },
  list: { paddingVertical: 0, paddingHorizontal: spacing.md, gap: 0 },
  listLoading: { marginVertical: spacing.lg },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  memberName: { fontFamily: fonts.medium, fontSize: 15 },
  override: { color: '#B5561A' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  linkText: { flex: 1, fontSize: 15 },
  pressed: { backgroundColor: '#EEF0F4' },
});
