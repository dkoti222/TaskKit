import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect } from 'react';
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
import type { Workspace } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { TextLink } from '@/components/misc';
import { RoleBadge, WorkspaceTile } from '@/components/workspace-ui';
import { useMe } from '@/hooks/use-me';
import { useInvitePreview, useWorkspaces } from '@/hooks/use-workspaces';
import { firstName, greeting, initials, plural } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/roles';
import { usePendingInvite } from '@/store/pending-invite';
import { colors, fonts, radius, spacing } from '@/theme';

// 06 · Your workspaces (home) and 28 · Empty state: first run.
// Board counts aren't shown yet: GET /workspaces doesn't return them (boards come later).
// The invite card comes from the last invite link opened on this phone: there's no API that
// lists a user's pending invites.
export default function HomeScreen() {
  const me = useMe();
  const workspaces = useWorkspaces();
  const pendingToken = usePendingInvite((s) => s.token);
  const invite = useInvitePreview(pendingToken);

  const refreshing = workspaces.isRefetching || me.isRefetching;
  const onRefresh = () => {
    void workspaces.refetch();
    void me.refetch();
    if (pendingToken) void invite.refetch();
  };

  const alreadyJoined =
    !!invite.data && !!workspaces.data?.some((w) => w.id === invite.data.workspace.id);
  const inviteDead = invite.isError && getErrorStatus(invite.error) === 400;

  // Forget links that can never be used here: expired/used/revoked, or already joined
  // (e.g. accepted on another device). Invites for another account are kept for that account.
  useEffect(() => {
    if (inviteDead || alreadyJoined) void usePendingInvite.getState().clear();
  }, [inviteDead, alreadyJoined]);

  // Only show invites addressed to this account for a workspace they aren't in yet.
  const showInvite = !!pendingToken && !!invite.data && invite.data.isForYou && !alreadyJoined;

  const isEmpty = workspaces.isSuccess && workspaces.data.length === 0;
  const name = me.data ? firstName(me.data.name) : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.flex}>
            <AppText variant="secondary" style={styles.hello} numberOfLines={1}>
              {name ? `${isEmpty ? 'Welcome' : greeting()}, ${name}` : ' '}
            </AppText>
            <AppText variant="title" accessibilityRole="header">
              Your workspaces
            </AppText>
          </View>
          {!isEmpty && me.data ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              onPress={() => router.navigate('/profile')}
              style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.7 }]}>
              <Text style={styles.avatarText}>{initials(me.data.name)}</Text>
            </Pressable>
          ) : null}
        </View>

        {showInvite ? (
          <InviteCard
            invitedBy={invite.data!.invitedBy}
            workspaceName={invite.data!.workspace.name}
            workspaceId={invite.data!.workspace.id}
            role={ROLE_LABEL[invite.data!.role]}
            onView={() =>
              router.push({ pathname: '/invite/[token]', params: { token: pendingToken! } })
            }
            // No decline API: forget the link on this phone; the invite expires on its own.
            onDecline={() => void usePendingInvite.getState().clear()}
          />
        ) : null}

        {workspaces.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : workspaces.isError ? (
          <View style={styles.card}>
            <AppText variant="label">Couldn{'’'}t load your workspaces</AppText>
            <AppText variant="secondary" style={{ color: colors.danger }}>
              {getErrorMessage(workspaces.error)}
            </AppText>
            <Button title="Try again" variant="secondary" onPress={() => workspaces.refetch()} />
          </View>
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <>
            {workspaces.data.map((ws) => (
              <WorkspaceRow key={ws.id} workspace={ws} />
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/new-workspace')}
              style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}>
              <Feather name="plus" size={18} color={colors.primary} />
              <Text style={styles.newText}>New workspace</Text>
            </Pressable>
            <View style={styles.joinLink}>
              <TextLink inline title="Have an invite link?" onPress={() => router.push('/join')} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InviteCard({
  invitedBy,
  workspaceName,
  workspaceId,
  role,
  onView,
  onDecline,
}: {
  invitedBy: string;
  workspaceName: string;
  workspaceId: string;
  role: string;
  onView: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={[styles.card, styles.inviteCard]}>
      <View style={styles.inviteTop}>
        <WorkspaceTile name={workspaceName} seed={workspaceId} size={36} />
        <AppText style={styles.inviteText}>
          <Text style={styles.bold}>{invitedBy}</Text> invited you to{' '}
          <Text style={styles.bold}>{workspaceName}</Text> as {role}
        </AppText>
      </View>
      <View style={styles.inviteActions}>
        <Button title="View invite" onPress={onView} style={styles.inviteButton} />
        <Button
          title="Decline"
          variant="secondary"
          onPress={onDecline}
          style={styles.inviteButton}
        />
      </View>
    </View>
  );
}

function WorkspaceRow({ workspace }: { workspace: Workspace }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${workspace.name}, ${plural(workspace.memberCount, 'member')}, you're ${workspace.role.toLowerCase()}`}
      onPress={() => router.push({ pathname: '/workspace/[id]', params: { id: workspace.id } })}
      style={({ pressed }) => [styles.card, styles.row, pressed && styles.pressed]}>
      <WorkspaceTile name={workspace.name} seed={workspace.id} />
      <View style={styles.flex}>
        <AppText style={styles.wsName} numberOfLines={1}>
          {workspace.name}
        </AppText>
        <AppText variant="small" style={styles.wsMeta}>
          {plural(workspace.memberCount, 'member')}
        </AppText>
      </View>
      <RoleBadge role={workspace.role} />
    </Pressable>
  );
}

/** 28 · Empty state: first run (GET /workspaces returned []). */
function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.illustration} accessible={false}>
        <View style={styles.illRow}>
          <View style={[styles.illBar, { backgroundColor: '#DCE4FC' }]} />
          <View style={[styles.illBar, { backgroundColor: '#FBE3D0' }]} />
          <View style={[styles.illBar, { backgroundColor: '#D3F0E4' }]} />
        </View>
        <View style={styles.illRow}>
          <View style={[styles.illBar, { backgroundColor: '#E8ECF6' }]} />
          <View style={[styles.illBar, { backgroundColor: '#EEF0F3' }]} />
          <View style={[styles.illBar, { backgroundColor: 'transparent' }]} />
        </View>
        <View style={styles.illRow}>
          <View style={[styles.illBar, { backgroundColor: '#EEF0F3' }]} />
          <View style={[styles.illBar, { backgroundColor: 'transparent' }]} />
          <View style={[styles.illBar, { backgroundColor: 'transparent' }]} />
        </View>
      </View>
      <AppText variant="heading" style={styles.emptyTitle}>
        Start your first workspace
      </AppText>
      <AppText variant="secondary" style={styles.emptyText}>
        A workspace is where your team keeps its boards. Create one, or ask a teammate to invite
        you.
      </AppText>
      <View style={styles.emptyActions}>
        <Button title="Create workspace" onPress={() => router.push('/new-workspace')} />
        <Button
          title="I have an invite link"
          variant="secondary"
          onPress={() => router.push('/join')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.xl, paddingTop: spacing.lg, gap: spacing.md },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  hello: { fontSize: 14 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.semibold, fontSize: 15, color: '#2A46C4' },
  loading: { marginTop: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  pressed: { backgroundColor: '#EEF0F4' },
  wsName: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  wsMeta: { fontSize: 13 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  newText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
  joinLink: { alignItems: 'center', paddingVertical: spacing.xs },
  inviteCard: { gap: spacing.md, padding: 14 },
  inviteTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  inviteText: { flex: 1, fontSize: 14, lineHeight: 20 },
  bold: { fontFamily: fonts.semibold },
  inviteActions: { flexDirection: 'row', gap: spacing.sm },
  inviteButton: { flex: 1, height: 42 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: spacing.xxl },
  illustration: {
    width: 120,
    height: 84,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    padding: 10,
    gap: 6,
    marginBottom: spacing.xl,
  },
  illRow: { flexDirection: 'row', gap: 6 },
  illBar: { flex: 1, height: 12, borderRadius: 4 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  emptyText: { textAlign: 'center', marginTop: spacing.sm, fontSize: 14, lineHeight: 21 },
  emptyActions: { alignSelf: 'stretch', marginTop: spacing.xl, gap: spacing.md },
});
