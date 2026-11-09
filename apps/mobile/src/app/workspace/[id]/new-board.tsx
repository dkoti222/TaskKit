import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import type { BoardVisibility } from '@/api/types';
import { AppText } from '@/components/app-text';
import { BOARD_COLORS, ColorSwatches, VisibilityOptions } from '@/components/board-ui';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useCreateBoard } from '@/hooks/use-board-mutations';
import { useWorkspace } from '@/hooks/use-workspaces';
import { colors, fonts, spacing } from '@/theme';

// 09 · Create board. "Start with default lists" from the design is left out until the lists API exists.
export default function NewBoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspace = useWorkspace(id);
  const create = useCreateBoard(id);

  const [name, setName] = useState('');
  const [color, setColor] = useState(BOARD_COLORS[0]);
  const [visibility, setVisibility] = useState<BoardVisibility>('WORKSPACE');
  const [formError, setFormError] = useState<string | null>(null);

  const close = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/workspace/[id]', params: { id } });

  const submit = () => {
    if (create.isPending) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) return setFormError('Board name must be at least 2 characters.');
    setFormError(null);
    create.mutate(
      { name: trimmed, color, visibility },
      {
        onSuccess: (board) => {
          // Swap this modal for the new board.
          close();
          router.push({ pathname: '/board/[id]', params: { id: board.id } });
        },
      },
    );
  };

  const error = formError ?? (create.isError ? getErrorMessage(create.error) : null);

  return (
    <Screen
      navHeader={<NavHeader title="New board" onBack={close} backIcon="x" />}
      bottomBar={<Button title="Create board" onPress={submit} loading={create.isPending} />}>
      <View style={styles.top}>
        <View style={[styles.preview, { backgroundColor: color }]} accessible={false}>
          <Text style={[styles.previewName, !name.trim() && styles.previewPlaceholder]} numberOfLines={1}>
            {name.trim() || 'Board name'}
          </Text>
        </View>

        <TextField
          label="Board name"
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (formError) setFormError(null);
          }}
          placeholder="e.g. App v2"
          autoFocus
          maxLength={50}
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={submit}
          invalid={!!formError}
        />

        <View style={styles.group}>
          <AppText variant="label">Background</AppText>
          <ColorSwatches value={color} onChange={setColor} />
        </View>

        <View style={styles.group}>
          <AppText variant="label">Visibility</AppText>
          <VisibilityOptions
            value={visibility}
            onChange={setVisibility}
            workspaceName={workspace.data?.name ?? 'this workspace'}
          />
        </View>

        <FormMessage message={error} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { marginTop: spacing.lg, gap: spacing.lg },
  preview: {
    height: 76,
    borderRadius: 12,
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  previewName: { fontFamily: fonts.semibold, fontSize: 17, color: colors.surface },
  previewPlaceholder: { opacity: 0.7 },
  group: { gap: spacing.sm },
});
