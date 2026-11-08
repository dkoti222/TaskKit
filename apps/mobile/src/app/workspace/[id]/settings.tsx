import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { InfoNote } from '@/components/info-note';
import { FormMessage } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { WorkspaceTile } from '@/components/workspace-ui';
import { useUpdateWorkspace } from '@/hooks/use-workspace-mutations';
import { useWorkspace } from '@/hooks/use-workspaces';
import { canManageWorkspace } from '@/lib/roles';
import { colors, fonts, radius, spacing } from '@/theme';

// 24 · Workspace settings — rename only for now (PATCH /workspaces/:id, Owner and Admin).
// Not built yet: logo, workspace rules toggles, transfer ownership, leave and delete.
export default function WorkspaceSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspace = useWorkspace(id);
  const update = useUpdateWorkspace(id);

  // null = not edited yet, so the field shows the saved value (and picks up refetches).
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const goBack = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/workspace/[id]', params: { id } });

  const ws = workspace.data;
  const canEdit = canManageWorkspace(ws?.role);
  const nameValue = name ?? ws?.name ?? '';
  const descValue = description ?? ws?.description ?? '';
  const dirty =
    !!ws && (nameValue.trim() !== ws.name || descValue.trim() !== (ws.description ?? ''));

  const save = () => {
    if (!ws || update.isPending || !dirty) return;
    const trimmed = nameValue.trim();
    if (trimmed.length < 2) return setFormError('Workspace name must be at least 2 characters.');
    setFormError(null);
    update.mutate({ name: trimmed, description: descValue.trim() }, { onSuccess: goBack });
  };

  const error = formError ?? (update.isError ? getErrorMessage(update.error) : null);

  const saveButton = canEdit ? (
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
      navHeader={<NavHeader title="Workspace settings" onBack={goBack} right={saveButton} />}>
      {workspace.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : workspace.isError ? (
        <View style={styles.top}>
          <FormMessage message={getErrorMessage(workspace.error)} />
          <Button title="Try again" variant="secondary" onPress={() => workspace.refetch()} />
        </View>
      ) : (
        <View style={styles.top}>
          {!canEdit ? (
            <InfoNote icon="lock">Only the Owner and Admins can change these settings.</InfoNote>
          ) : null}

          <View style={styles.card}>
            <WorkspaceTile name={nameValue || ws!.name} seed={ws!.id} size={48} />
            <TextField
              label="Name"
              value={nameValue}
              onChangeText={setName}
              editable={canEdit}
              maxLength={50}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={save}
              invalid={!!formError}
            />
            <TextField
              label="Description"
              value={descValue}
              onChangeText={setDescription}
              editable={canEdit}
              placeholder={canEdit ? 'What does this team work on?' : 'No description'}
              multiline
              maxLength={300}
              style={styles.multiline}
            />
          </View>

          <FormMessage message={error} />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/workspace/[id]/members', params: { id } })}
            style={({ pressed }) => [styles.card, styles.linkRow, pressed && styles.pressed]}>
            <AppText style={styles.linkText}>Members and roles</AppText>
            <AppText variant="small">{ws!.memberCount}</AppText>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  multiline: { height: 84, paddingTop: 12, textAlignVertical: 'top' },
  save: { fontFamily: fonts.semibold, fontSize: 16, color: colors.primary },
  saveDisabled: { color: colors.placeholder },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 14 },
  linkText: { flex: 1, fontSize: 15 },
  pressed: { backgroundColor: '#EEF0F4' },
});
