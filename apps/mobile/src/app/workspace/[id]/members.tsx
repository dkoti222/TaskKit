import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage, getErrorStatus } from '@/api/errors';
import type { Member, PendingInvitation } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormMessage, TextLink } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { RoleDropdown, RoleSheet } from '@/components/role-picker';
import { MemberAvatar, RoleBadge } from '@/components/workspace-ui';
import { useMe } from '@/hooks/use-me';
import {
  useChangeMemberRole,
  useRemoveMember,
  useRevokeInvitation,
} from '@/hooks/use-workspace-mutations';
import { useInvitations, useMembers, useWorkspace } from '@/hooks/use-workspaces';
import { expiresIn, firstName, plural } from '@/lib/format';
import { ROLE_LABEL, assignableRoles, canManageMember, canManageWorkspace } from '@/lib/roles';
import { colors, fonts, radius, spacing } from '@/theme';

// 10 · Members and roles.
// Role dropdowns and Remove only appear on rows the current user may change (see lib/roles.ts);
// everyone else sees a plain role badge. Pending invites are only shown to Owner and Admin.
// "Resend" from the design is left out: there's no resend API.
export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const workspace = useWorkspace(id);
  const members = useMembers(id);
  const myRole = workspace.data?.role;
  const canManage = canManageWorkspace(myRole);
  const invitations = useInvitations(id, canManage);

  const changeRole = useChangeMemberRole(id);
  const remove = useRemoveMember(id);
  const revoke = useRevokeInvitation(id);

  const [query, setQuery] = useState('');
  const [sheetFor, setSheetFor] = useState<Member | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [revoking, setRevoking] = useState<PendingInvitation | null>(null);

  const goBack = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/workspace/[id]', params: { id } });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = members.data ?? [];
    return q
      ? list.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      : list;
  }, [members.data, query]);

  const actor = { userId: me.data?.id ?? '', role: myRole };

  const onRefresh = () => {
    void workspace.refetch();
    void members.refetch();
    if (canManage) void invitations.refetch();
  };

  // Removed from the workspace (or it was deleted) while on this screen.
  if (getErrorStatus(members.error) === 404 || getErrorStatus(workspace.error) === 404) {
    return (
      <SafeAreaView style={styles.safe}>
        <NavHeader title="Members" onBack={() => router.replace('/')} />
        <View style={styles.centered}>
          <AppText variant="heading">You don{'’'}t have access to this workspace</AppText>
          <Button title="Go to all workspaces" onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  const roleError = changeRole.isError ? getErrorMessage(changeRole.error) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <NavHeader
        title="Members"
        onBack={goBack}
        right={
          canManage ? (
            <TextLink
              title="Invite"
              onPress={() => router.push({ pathname: '/workspace/[id]/invite', params: { id } })}
            />
          ) : null
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={members.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }>
        <View style={styles.search}>
          <Feather name="search" size={18} color={colors.placeholder} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or email"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search members"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable accessibilityLabel="Clear search" hitSlop={10} onPress={() => setQuery('')}>
              <Feather name="x-circle" size={17} color={colors.placeholder} />
            </Pressable>
          ) : null}
        </View>

        {members.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : members.isError ? (
          <View style={[styles.card, styles.padded]}>
            <FormMessage message={getErrorMessage(members.error)} />
            <Button title="Try again" variant="secondary" onPress={() => members.refetch()} />
          </View>
        ) : (
          <>
            <AppText style={styles.sectionLabel}>
              {query
                ? `${plural(filtered.length, 'result')}`
                : plural(members.data.length, 'member')}
            </AppText>
            <FormMessage message={roleError} />
            <View style={styles.card}>
              {filtered.length === 0 ? (
                <AppText variant="secondary" style={styles.noResults}>
                  No members match “{query.trim()}”.
                </AppText>
              ) : (
                filtered.map((member, index) => {
                  const isMe = member.userId === me.data?.id;
                  const editable = !!me.data && canManageMember(actor, member);
                  return (
                    <View
                      key={member.userId}
                      style={[styles.memberRow, index > 0 && styles.divider]}>
                      <MemberAvatar name={member.name} seed={member.userId} />
                      <View style={styles.flex}>
                        <AppText style={styles.name} numberOfLines={1}>
                          {member.name}
                          {isMe ? <Text style={styles.you}> (you)</Text> : null}
                        </AppText>
                        <AppText variant="small" numberOfLines={1}>
                          {member.email}
                        </AppText>
                      </View>
                      {editable ? (
                        <RoleDropdown
                          role={member.role}
                          label={`${member.name}, ${ROLE_LABEL[member.role]}`}
                          disabled={
                            changeRole.isPending && changeRole.variables?.userId === member.userId
                          }
                          onPress={() => {
                            changeRole.reset();
                            setSheetFor(member);
                          }}
                        />
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {canManage && invitations.data && invitations.data.length > 0 ? (
          <>
            <AppText style={[styles.sectionLabel, styles.sectionGap]}>Pending invites</AppText>
            <View style={styles.card}>
              {invitations.data.map((invite, index) => (
                <View key={invite.id} style={[styles.memberRow, index > 0 && styles.divider]}>
                  <View style={styles.inviteIcon}>
                    <Feather name="mail" size={16} color={colors.muted} />
                  </View>
                  <View style={styles.flex}>
                    <AppText style={styles.name} numberOfLines={1}>
                      {invite.email}
                    </AppText>
                    <AppText variant="small">
                      {ROLE_LABEL[invite.role]} · {expiresIn(invite.expiresAt)}
                    </AppText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Revoke invite for ${invite.email}`}
                    hitSlop={8}
                    onPress={() => {
                      revoke.reset();
                      setRevoking(invite);
                    }}
                    style={({ pressed }) => [styles.revoke, pressed && { opacity: 0.6 }]}>
                    <Text style={styles.revokeText}>Revoke</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {sheetFor ? (
        <RoleSheet
          visible
          title={`${firstName(sheetFor.name)}’s role`}
          current={sheetFor.role}
          options={assignableRoles(myRole)}
          onClose={() => setSheetFor(null)}
          onSelect={(role) => {
            const target = sheetFor;
            setSheetFor(null);
            if (role !== target.role) changeRole.mutate({ userId: target.userId, role });
          }}
          onRemove={() => {
            const target = sheetFor;
            setSheetFor(null);
            remove.reset();
            // iOS won't present a modal while another is still animating closed, so wait
            // for the sheet to finish closing before opening the confirm dialog.
            setTimeout(() => setRemoving(target), Platform.OS === 'ios' ? 400 : 0);
          }}
        />
      ) : null}

      <ConfirmDialog
        visible={!!removing}
        icon="user-x"
        title={`Remove ${removing ? firstName(removing.name) : ''}?`}
        message={`${removing?.name ?? ''} will lose access to ${workspace.data?.name ?? 'this workspace'} and its boards. You can invite them again later.`}
        confirmLabel="Remove member"
        loading={remove.isPending}
        error={remove.isError ? getErrorMessage(remove.error) : null}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          removing && remove.mutate(removing.userId, { onSuccess: () => setRemoving(null) })
        }
      />

      <ConfirmDialog
        visible={!!revoking}
        icon="mail"
        title="Revoke this invite?"
        message={`The link sent to ${revoking?.email ?? ''} will stop working.`}
        confirmLabel="Revoke invite"
        loading={revoke.isPending}
        error={revoke.isError ? getErrorMessage(revoke.error) : null}
        onCancel={() => setRevoking(null)}
        onConfirm={() =>
          revoking && revoke.mutate(revoking.id, { onSuccess: () => setRevoking(null) })
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  flex: { flex: 1 },
  loading: { marginTop: spacing.xxl },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
  },
  sectionLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, marginBottom: -4 },
  sectionGap: { marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  padded: { padding: spacing.lg, gap: spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 62,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  name: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  you: { fontFamily: fonts.regular, color: colors.muted },
  noResults: { padding: spacing.lg, textAlign: 'center' },
  inviteIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revoke: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 4 },
  revokeText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger },
});
