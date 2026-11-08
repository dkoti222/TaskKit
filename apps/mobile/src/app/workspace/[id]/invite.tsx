import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import type { AssignableRole } from '@/api/types';
import { createInvitation } from '@/api/workspaces';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmailChips, normalizeEmail } from '@/components/email-chips';
import { InfoNote } from '@/components/info-note';
import { FormMessage } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { RoleOptions } from '@/components/role-picker';
import { Screen } from '@/components/screen';
import { useWorkspace, workspaceKeys } from '@/hooks/use-workspaces';
import { isEmail } from '@/lib/validation';
import { assignableRoles, canManageWorkspace } from '@/lib/roles';
import { colors, spacing } from '@/theme';

type Failure = { email: string; message: string };

// 11 · Invite members. One POST /workspaces/:id/invitations per email, all with the chosen role.
// The API emails each person a taskkit://invite/<token> link that expires in 7 days.
// "Or share an invite link" from the design is left out: the API has no shareable link.
export default function InviteMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const workspace = useWorkspace(id);
  const myRole = workspace.data?.role;
  const roles = assignableRoles(myRole); // Admin only shows for the Owner

  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [role, setRole] = useState<AssignableRole>('MEMBER');
  const [formError, setFormError] = useState<string | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);

  const close = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/workspace/[id]/members', params: { id } });

  const mutation = useMutation({
    mutationFn: async (input: { emails: string[]; role: AssignableRole }) => {
      const results = await Promise.allSettled(
        input.emails.map((email) => createInvitation(id, { email, role: input.role })),
      );
      return input.emails.flatMap((email, i): Failure[] => {
        const result = results[i];
        return result.status === 'rejected'
          ? [{ email, message: getErrorMessage(result.reason) }]
          : [];
      });
    },
    onSuccess: (failed) => {
      if (failed.length === 0) {
        close();
        return;
      }
      // Keep only the addresses that failed so the user can fix or remove them and retry.
      setEmails(failed.map((f) => f.email));
      setFailures(failed);
    },
    onSettled: () =>
      // Pending invites list, and the workspace in case a 403 means our role changed.
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(id) }),
  });

  const submit = () => {
    if (mutation.isPending) return;
    const pending = normalizeEmail(draft);
    if (pending && !isEmail(pending)) return setFormError(`“${pending}” isn’t a valid email.`);
    const all = pending && !emails.includes(pending) ? [...emails, pending] : emails;
    if (all.length === 0) return setFormError('Add at least one email address.');
    setDraft('');
    setEmails(all);
    setFormError(null);
    setFailures([]);
    mutation.mutate({ emails: all, role });
  };

  const title = workspace.data ? `Invite to ${workspace.data.name}` : 'Invite members';
  const count = emails.length + (isEmail(draft) && !emails.includes(normalizeEmail(draft)) ? 1 : 0);
  const sendLabel = count > 1 ? `Send ${count} invites` : 'Send invite';

  if (workspace.isPending) {
    return (
      <Screen navHeader={<NavHeader title={title} onBack={close} backIcon="x" />}>
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </Screen>
    );
  }

  if (workspace.isError || !canManageWorkspace(myRole)) {
    return (
      <Screen navHeader={<NavHeader title={title} onBack={close} backIcon="x" />}>
        <View style={styles.top}>
          {workspace.isError ? (
            <FormMessage message={getErrorMessage(workspace.error)} />
          ) : (
            <InfoNote icon="lock">Only the Owner and Admins can invite people.</InfoNote>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      navHeader={<NavHeader title={title} onBack={close} backIcon="x" />}
      bottomBar={<Button title={sendLabel} onPress={submit} loading={mutation.isPending} />}>
      <View style={styles.top}>
        <View style={styles.group}>
          <AppText variant="label">Email addresses</AppText>
          <EmailChips
            emails={emails}
            onChange={(next) => {
              setEmails(next);
              setFailures((f) => f.filter((x) => next.includes(x.email)));
            }}
            draft={draft}
            onDraftChange={setDraft}
            invalid={!!formError || failures.length > 0}
            accessibilityLabel="Email addresses to invite"
          />
          <AppText variant="small">Separate addresses with a space or comma.</AppText>
        </View>

        {failures.length > 0 ? (
          <View style={styles.failures} accessibilityLiveRegion="polite">
            <AppText variant="label" style={styles.failTitle}>
              {failures.length === 1 ? 'This invite wasn’t sent' : 'These invites weren’t sent'}
            </AppText>
            {failures.map((f) => (
              <AppText key={f.email} variant="small" style={styles.failText}>
                {f.email}: {f.message}
              </AppText>
            ))}
            <AppText variant="small">Others were sent. Remove or fix these and try again.</AppText>
          </View>
        ) : null}

        <View style={styles.group}>
          <AppText variant="label">Role</AppText>
          <RoleOptions options={roles} value={role} onChange={setRole} />
          {myRole === 'ADMIN' ? (
            <AppText variant="small">Only the Owner can invite Admins.</AppText>
          ) : null}
        </View>

        <InfoNote icon="clock">
          Each person gets an email with a link that works once and expires in 7 days.
        </InfoNote>

        <FormMessage
          message={formError ?? (mutation.isError ? getErrorMessage(mutation.error) : null)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  top: { gap: spacing.xl, marginTop: spacing.lg },
  group: { gap: 8 },
  failures: {
    gap: 4,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
  },
  failTitle: { color: colors.danger },
  failText: { color: colors.danger },
});
