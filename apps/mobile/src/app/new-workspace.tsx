import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import { createInvitation, createWorkspace } from '@/api/workspaces';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmailChips } from '@/components/email-chips';
import { InfoNote } from '@/components/info-note';
import { FormMessage } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { WorkspaceTile } from '@/components/workspace-ui';
import { workspaceKeys } from '@/hooks/use-workspaces';
import { isEmail } from '@/lib/validation';
import { colors, spacing } from '@/theme';

// 07 · Create workspace. POST /workspaces, then one POST /invitations per teammate (as Member).
// "Change logo" from the design is left out: there's no upload API yet.
export default function NewWorkspaceScreen() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const mutation = useMutation({
    mutationFn: async (input: { name: string; description?: string; emails: string[] }) => {
      const workspace = await createWorkspace({ name: input.name, description: input.description });
      // The workspace exists now; a failed invite shouldn't undo that, so collect failures.
      const results = await Promise.allSettled(
        input.emails.map((email) => createInvitation(workspace.id, { email, role: 'MEMBER' })),
      );
      const failed = input.emails
        .map((email, i) => ({ email, result: results[i] }))
        .filter((r) => r.result.status === 'rejected')
        .map((r) => `${r.email}: ${getErrorMessage((r.result as PromiseRejectedResult).reason)}`);
      return { workspace, failed };
    },
    onSuccess: ({ workspace, failed }) => {
      queryClient.setQueryData(workspaceKeys.detail(workspace.id), workspace);
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      router.replace({ pathname: '/workspace/[id]', params: { id: workspace.id } });
      if (failed.length) {
        Alert.alert(
          'Workspace created',
          `Some invites weren’t sent:\n\n${failed.join('\n')}\n\nYou can invite them from Members.`,
        );
      }
    },
  });

  const submit = () => {
    if (mutation.isPending) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) return setFormError('Workspace name must be at least 2 characters.');
    const pending = draft.trim().toLowerCase();
    if (pending && !isEmail(pending)) return setFormError(`“${pending}” isn’t a valid email.`);
    const all = pending && !emails.includes(pending) ? [...emails, pending] : emails;
    setFormError(null);
    mutation.mutate({
      name: trimmed,
      description: description.trim() || undefined,
      emails: all,
    });
  };

  const error = formError ?? (mutation.isError ? getErrorMessage(mutation.error) : null);

  return (
    <Screen
      navHeader={<NavHeader title="New workspace" onBack={close} backIcon="x" />}
      bottomBar={<Button title="Create workspace" onPress={submit} loading={mutation.isPending} />}>
      <View style={styles.top}>
        <WorkspaceTile name={name || 'New workspace'} seed="new" size={52} />

        <TextField
          label="Workspace name"
          value={name}
          onChangeText={setName}
          placeholder="Acme design"
          autoCapitalize="words"
          maxLength={50}
          returnKeyType="next"
          autoFocus
          invalid={!!formError && name.trim().length < 2}
        />

        <TextField
          label="Description"
          labelHint="(optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What does this team work on?"
          multiline
          maxLength={300}
          style={styles.multiline}
        />

        <View style={styles.group}>
          <AppText variant="label">
            Invite teammates <Optional />
          </AppText>
          <EmailChips
            emails={emails}
            onChange={setEmails}
            draft={draft}
            onDraftChange={setDraft}
            placeholder="name@company.com"
            accessibilityLabel="Invite teammates by email"
          />
          <AppText variant="small">
            They{'’'}ll join as Members. You can change roles later.
          </AppText>
        </View>

        <InfoNote icon="user" tone="primary">
          You’ll be the Owner of this workspace. Only Owners can delete it.
        </InfoNote>

        <FormMessage message={error} />
      </View>
    </Screen>
  );
}

function Optional() {
  return <AppText style={styles.optional}>(optional)</AppText>;
}

const styles = StyleSheet.create({
  top: { gap: spacing.lg, marginTop: spacing.lg },
  group: { gap: 8 },
  multiline: { height: 84, paddingTop: 12, textAlignVertical: 'top' },
  optional: { fontSize: 14, color: colors.muted },
});
