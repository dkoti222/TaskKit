import Feather from '@expo/vector-icons/Feather';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { logOut } from '@/api/auth';
import { getErrorMessage, getErrorStatus } from '@/api/errors';
import type { AssignableRole } from '@/api/types';
import { acceptInvitation } from '@/api/workspaces';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { InfoNote } from '@/components/info-note';
import { FormMessage, IconButton } from '@/components/misc';
import { Screen } from '@/components/screen';
import { MemberAvatar, RoleBadge, WorkspaceTile } from '@/components/workspace-ui';
import { useMe } from '@/hooks/use-me';
import { inviteKey, useInvitePreview, useWorkspaces, workspaceKeys } from '@/hooks/use-workspaces';
import { usePendingInvite } from '@/store/pending-invite';
import { useSession } from '@/store/session';
import { colors, fonts, spacing } from '@/theme';

const ROLE_NOTE: Record<AssignableRole, string> = {
  ADMIN:
    'As an Admin you can manage members, roles and all boards. The Owner can change your role later.',
  MEMBER:
    'As a Member you can create boards, lists and cards, comment and move cards. An Admin can change your role later.',
  VIEWER:
    'As a Viewer you can see boards and cards but can’t edit, move or comment. An Admin can change your role later.',
};

// 12 · Accept invite — opened from taskkit://invite/<token>, the Home invite card, or a pasted link.
// GET /invitations/:token to preview, POST /invitations/:token/accept to join.
// The design's "4 members · 1 board" box is left out: the preview API doesn't return counts.
export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const signedIn = useSession((s) => s.status) === 'signedIn';
  const savePending = usePendingInvite((s) => s.save);

  // Remember the link until it's accepted or declined (shows as a card on Home,
  // and survives logging in when the link was opened while logged out).
  useEffect(() => {
    if (token) void savePending(token);
  }, [token, savePending]);

  const close = () =>
    router.canGoBack() ? router.back() : router.replace(signedIn ? '/' : '/welcome');
  const header = <IconButton icon="x" label="Close" onPress={close} />;

  if (!signedIn) {
    return (
      <Screen header={header}>
        <View style={styles.hero}>
          <View style={styles.mailTile}>
            <Feather name="mail" size={26} color={colors.primary} />
          </View>
          <AppText variant="title" style={styles.center}>
            You{'’'}ve been invited
          </AppText>
          <AppText variant="secondary" style={styles.center}>
            Log in or create an account with the email address the invite was sent to. We{'’'}ll
            show the invite on your Home screen.
          </AppText>
        </View>
        <View style={styles.actions}>
          <Button title="Log in" onPress={() => router.replace('/login')} />
          <Button
            title="Create account"
            variant="secondary"
            onPress={() => router.replace('/sign-up')}
          />
        </View>
      </Screen>
    );
  }

  return <SignedInInvite token={token} header={header} close={close} />;
}

function SignedInInvite({
  token,
  header,
  close,
}: {
  token: string;
  header: ReactNode;
  close: () => void;
}) {
  const queryClient = useQueryClient();
  const me = useMe();
  const preview = useInvitePreview(token);
  const workspaces = useWorkspaces();
  const clearPending = usePendingInvite((s) => s.clear);

  const accept = useMutation({
    mutationFn: () => acceptInvitation(token),
    onSuccess: (result) => {
      // Leave first: refreshing the list while still here would briefly show "already a member".
      router.replace({ pathname: '/workspace/[id]', params: { id: result.workspaceId } });
      void clearPending();
      queryClient.removeQueries({ queryKey: inviteKey(token) });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });

  const decline = async () => {
    // No decline API: forget the link on this phone. The invite expires on its own.
    await clearPending();
    close();
  };

  const invalid = preview.isError && getErrorStatus(preview.error) === 400;

  // A used, revoked or expired link will never work, so stop showing it on Home.
  useEffect(() => {
    if (invalid) void clearPending();
  }, [invalid, clearPending]);

  if (preview.isPending) {
    return (
      <Screen header={header}>
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </Screen>
    );
  }

  if (preview.isError) {
    return (
      <Screen header={header}>
        <View style={styles.hero}>
          <View style={[styles.mailTile, styles.greyTile]}>
            <Feather name="link-2" size={26} color={colors.muted} />
          </View>
          <AppText variant="title" style={styles.center}>
            {invalid ? 'This invite can’t be used' : 'Couldn’t load the invite'}
          </AppText>
          <AppText variant="secondary" style={styles.center}>
            {invalid
              ? 'It may have expired, been cancelled, or already been used. Ask the person who invited you to send a new one.'
              : getErrorMessage(preview.error)}
          </AppText>
        </View>
        <View style={styles.actions}>
          {invalid ? null : <Button title="Try again" onPress={() => preview.refetch()} />}
          <Button
            title="Go to your workspaces"
            variant={invalid ? 'primary' : 'secondary'}
            onPress={() => router.replace('/')}
          />
        </View>
      </Screen>
    );
  }

  const invite = preview.data;
  const alreadyMember = workspaces.data?.some((w) => w.id === invite.workspace.id) ?? false;
  const expires = new Date(invite.expiresAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  // Accept would be refused with 403 (wrong account), so explain instead of offering it.
  const wrongAccount = !invite.isForYou || getErrorStatus(accept.error) === 403;

  return (
    <Screen
      header={header}
      footer={
        <View style={styles.footer}>
          {!wrongAccount && !alreadyMember ? (
            <AppText variant="small" style={styles.center}>
              Invite expires {expires}
            </AppText>
          ) : null}
          {alreadyMember ? (
            <Button
              title={`Open ${invite.workspace.name}`}
              onPress={async () => {
                await usePendingInvite.getState().clear();
                router.replace({
                  pathname: '/workspace/[id]',
                  params: { id: invite.workspace.id },
                });
              }}
            />
          ) : wrongAccount ? (
            <Button
              title="Log out and switch account"
              onPress={() => void logOut()} // the link stays saved, so it shows after logging in
            />
          ) : (
            <Button
              title="Join workspace"
              onPress={() => accept.mutate()}
              loading={accept.isPending}
            />
          )}
          <Button
            title={alreadyMember || wrongAccount ? 'Not now' : 'Decline'}
            variant="secondary"
            onPress={alreadyMember || wrongAccount ? close : decline}
            disabled={accept.isPending}
          />
        </View>
      }>
      <View style={styles.hero}>
        <View>
          <WorkspaceTile name={invite.workspace.name} seed={invite.workspace.id} size={68} />
          <View style={styles.inviter}>
            <MemberAvatar name={invite.invitedBy} seed={invite.invitedBy} size={28} />
          </View>
        </View>
        <AppText style={styles.title} accessibilityRole="header">
          {invite.invitedBy} invited you to join {invite.workspace.name}
        </AppText>
        <View style={styles.joinAs}>
          <AppText variant="secondary">You{'’'}ll join as</AppText>
          <RoleBadge role={invite.role} />
        </View>
      </View>

      {alreadyMember ? (
        <InfoNote icon="check-circle">
          {`You’re already a member of ${invite.workspace.name}.`}
        </InfoNote>
      ) : wrongAccount ? (
        <InfoNote icon="alert-circle">
          {`This invite was sent to ${invite.email}, but you’re logged in as ${me.data?.email ?? 'another account'}. Log in with ${invite.email} to accept it.`}
        </InfoNote>
      ) : (
        <InfoNote icon="info">{ROLE_NOTE[invite.role]}</InfoNote>
      )}

      {accept.isError && !wrongAccount ? (
        <FormMessage message={getErrorMessage(accept.error)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl * 2 },
  hero: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xxl, marginBottom: spacing.sm },
  center: { textAlign: 'center' },
  mailTile: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  greyTile: { backgroundColor: '#EEF0F3' },
  inviter: {
    position: 'absolute',
    right: -8,
    bottom: -6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 21,
    lineHeight: 28,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  joinAs: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { gap: spacing.md, marginTop: spacing.xl },
  footer: { alignSelf: 'stretch', gap: spacing.md },
});
