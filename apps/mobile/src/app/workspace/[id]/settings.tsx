import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { InfoNote } from '@/components/info-note';
import { FormMessage } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { WorkspaceTile } from '@/components/workspace-ui';
import {
  useDeleteWorkspace,
  useLeaveWorkspace,
  useUpdateWorkspace,
  useWorkspaceLogo,
} from '@/hooks/use-workspace-mutations';
import { useWorkspace } from '@/hooks/use-workspaces';
import { canManageWorkspace } from '@/lib/roles';
import { colors, fonts, radius, spacing } from '@/theme';

// 24 · Workspace settings. Everyone can open it: Owner/Admin can rename, the Owner can transfer
// ownership, and everyone but the Owner can leave.
// Owner/Admin can also change the logo and the workspace rules (Members can create boards,
// Allow invite links). The Owner can delete the workspace (typing its name to confirm).
export default function WorkspaceSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspace = useWorkspace(id);
  const update = useUpdateWorkspace(id);
  const leave = useLeaveWorkspace(id);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const remove = useDeleteWorkspace(id);
  const logo = useWorkspaceLogo(id);
  // The rules save on tap, separately from the Save button.
  const rules = useUpdateWorkspace(id);

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    logo.mutate({ uri: asset.uri, mimeType });
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typedName, setTypedName] = useState('');

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
            <View style={styles.logoRow}>
              <WorkspaceTile
                name={nameValue || ws!.name}
                seed={ws!.id}
                size={48}
                logoUrl={ws!.logoUrl}
              />
              {canEdit ? (
                <>
                  <Button
                    title={ws!.logoUrl ? 'Change logo' : 'Add logo'}
                    variant="secondary"
                    loading={logo.isPending}
                    onPress={pickLogo}
                    style={styles.logoButton}
                  />
                  {ws!.logoUrl && !logo.isPending ? (
                    <Button
                      title="Remove"
                      variant="text"
                      onPress={() => logo.mutate(null)}
                      style={styles.logoButton}
                    />
                  ) : null}
                </>
              ) : null}
            </View>
            <FormMessage message={logo.isError ? getErrorMessage(logo.error) : null} />
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

          <View style={[styles.card, styles.rules]}>
            {(
              [
                [
                  'membersCanCreateBoards',
                  'Members can create boards',
                  'Off means only Owner and Admin can',
                ],
                ['allowInviteLinks', 'Allow invite links', 'Links expire after 7 days'],
              ] as const
            ).map(([key, title, detail], index) => {
              const on = ws![key] !== false;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: !canEdit }}
                  disabled={!canEdit || rules.isPending}
                  onPress={() => rules.mutate({ [key]: !on })}
                  style={({ pressed }) => [
                    styles.ruleRow,
                    index > 0 && styles.ruleDivider,
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.flexOne}>
                    <AppText style={styles.ruleTitle}>{title}</AppText>
                    <AppText variant="small">{detail}</AppText>
                  </View>
                  <View style={[styles.box, on && styles.boxOn, !canEdit && styles.boxOff]}>
                    {on ? <Feather name="check" size={14} color={colors.surface} /> : null}
                  </View>
                </Pressable>
              );
            })}
            <FormMessage message={rules.isError ? getErrorMessage(rules.error) : null} />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/workspace/[id]/archived', params: { id } })}
            style={({ pressed }) => [styles.card, styles.linkRow, pressed && styles.pressed]}>
            <Feather name="archive" size={18} color={colors.ink} />
            <AppText style={styles.linkText}>Archived boards</AppText>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>

          {canEdit ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/workspace/[id]/audit', params: { id } })}
              style={({ pressed }) => [styles.card, styles.linkRow, pressed && styles.pressed]}>
              <Feather name="shield" size={18} color={colors.ink} />
              <AppText style={styles.linkText}>Audit log</AppText>
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          ) : null}

          <AppText style={styles.dangerLabel}>
            {ws!.role === 'OWNER' ? 'Danger zone · Owner only' : 'Danger zone'}
          </AppText>
          <View style={[styles.card, styles.dangerCard]}>
            {ws!.role === 'OWNER' ? (
              <DangerRow
                title="Transfer ownership"
                detail="Make another member the Owner. You become an Admin."
                onPress={() =>
                  router.push({ pathname: '/workspace/[id]/transfer', params: { id } })
                }
              />
            ) : null}
            <DangerRow
              title="Leave workspace"
              detail={
                ws!.role === 'OWNER'
                  ? 'Transfer ownership first. A workspace needs one Owner.'
                  : 'You’ll lose access to its boards. You can be invited again.'
              }
              danger={ws!.role !== 'OWNER'}
              disabled={ws!.role === 'OWNER'}
              divider={ws!.role === 'OWNER'}
              onPress={() => {
                leave.reset();
                setConfirmLeave(true);
              }}
            />
            {ws!.role === 'OWNER' ? (
              <DangerRow
                title="Delete workspace"
                detail="Deletes every board, list, card and file in it, for everyone. Can’t be undone."
                danger
                divider
                onPress={() => {
                  remove.reset();
                  setTypedName('');
                  setConfirmDelete(true);
                }}
              />
            ) : null}
          </View>
          {confirmDelete ? (
            <View style={[styles.card, styles.deleteCard]}>
              <AppText style={styles.deleteTitle}>Delete {ws!.name}?</AppText>
              <AppText variant="secondary">
                Everything in it is deleted for all {ws!.memberCount} members. Type the workspace
                name to confirm.
              </AppText>
              <TextField
                label="Workspace name"
                value={typedName}
                onChangeText={setTypedName}
                placeholder={ws!.name}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <FormMessage message={remove.isError ? getErrorMessage(remove.error) : null} />
              <Button
                title="Delete workspace"
                variant="danger"
                loading={remove.isPending}
                disabled={typedName.trim() !== ws!.name}
                onPress={() => remove.mutate(undefined, { onSuccess: () => router.dismissTo('/') })}
              />
              <Button
                title="Cancel"
                variant="secondary"
                disabled={remove.isPending}
                onPress={() => setConfirmDelete(false)}
              />
            </View>
          ) : null}
        </View>
      )}

      <ConfirmDialog
        visible={confirmLeave}
        icon="log-out"
        title={`Leave ${ws?.name ?? 'this workspace'}?`}
        message="You'll lose access to its boards right away. To come back, someone will have to invite you again."
        confirmLabel="Leave workspace"
        loading={leave.isPending}
        error={leave.isError ? getErrorMessage(leave.error) : null}
        onConfirm={() =>
          leave.mutate(undefined, {
            onSuccess: () => {
              setConfirmLeave(false);
              router.dismissTo('/');
            },
          })
        }
        onCancel={() => setConfirmLeave(false)}
      />
    </Screen>
  );
}

function DangerRow({
  title,
  detail,
  onPress,
  danger,
  disabled,
  divider,
}: {
  title: string;
  detail: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={disabled ? detail : undefined}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dangerRow,
        divider && styles.dangerDivider,
        pressed && styles.pressed,
      ]}>
      <View style={styles.flex}>
        <AppText
          style={[
            styles.dangerTitle,
            danger && { color: colors.danger },
            disabled && { color: colors.placeholder },
          ]}>
          {title}
        </AppText>
        <AppText variant="small">{detail}</AppText>
      </View>
      {disabled ? null : <Feather name="chevron-right" size={18} color={colors.muted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logoButton: { minHeight: 44, height: 44, paddingHorizontal: spacing.lg },
  rules: { paddingVertical: 0, gap: 0 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  ruleDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  ruleTitle: { fontSize: 15 },
  flexOne: { flex: 1, gap: 2 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  boxOff: { opacity: 0.5 },
  deleteCard: { borderColor: colors.danger, gap: spacing.md },
  deleteTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.danger },
  flex: { flex: 1 },
  dangerLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.danger,
    marginBottom: -spacing.sm,
  },
  dangerCard: { padding: 0, gap: 0, overflow: 'hidden', borderColor: '#F0C9CE' },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  dangerDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  dangerTitle: { fontFamily: fonts.semibold, fontSize: 15 },
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
