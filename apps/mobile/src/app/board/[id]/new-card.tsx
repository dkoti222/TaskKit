import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import type { CardPerson, Label } from '@/api/types';
import { AppText } from '@/components/app-text';
import { BoardAccessRemoved, useBoardAccessLost } from '@/components/board-access';
import { Button } from '@/components/button';
import { DueDateField } from '@/components/due-date-field';
import { InfoNote } from '@/components/info-note';
import { FormMessage } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { LabelPicker, PeoplePicker, PickerStatus } from '@/components/pickers';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useBoardContent, useLabels } from '@/hooks/use-board-content';
import { useBoardPeople } from '@/hooks/use-board-people';
import { findCachedBoard } from '@/hooks/use-boards';
import { useCreateCard } from '@/hooks/use-cards';
import { canEditCards, canManageLabels } from '@/lib/roles';
import { colors, fonts, radius, spacing } from '@/theme';

// 16 · New card. Opened from "Add card" at the bottom of a list (params: board id, listId).
// POST /lists/:id/cards, then one PUT per person and label picked here.
export default function NewCardScreen() {
  const { id, listId } = useLocalSearchParams<{ id: string; listId: string }>();
  const queryClient = useQueryClient();
  const content = useBoardContent(id);
  const [cached] = useState(() => findCachedBoard(queryClient, id));
  const board = content.data?.board;
  const workspaceId = board?.workspaceId ?? cached?.workspaceId;
  const lost = useBoardAccessLost(content.error, workspaceId);
  const labels = useLabels(id);
  const people = useBoardPeople(board);
  const create = useCreateCard(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<CardPerson[]>([]);
  const [picked, setPicked] = useState<Label[]>([]);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [extrasError, setExtrasError] = useState<string | null>(null);

  const list = content.data?.lists.find((l) => l.id === listId);
  const close = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/board/[id]', params: { id } });

  if (lost)
    return <BoardAccessRemoved boardName={board?.name ?? cached?.name} workspaceId={workspaceId} />;

  const header = (
    <NavHeader
      title="New card"
      subtitle={board && list ? `${board.name} · ${list.name}` : undefined}
      backIcon="x"
      onBack={close}
    />
  );

  // Loading, load error, list gone, or no permission: nothing to fill in.
  let blocker: React.ReactNode = null;
  if (content.isPending)
    blocker = <ActivityIndicator color={colors.primary} style={styles.loading} />;
  else if (content.isError && !content.data)
    blocker = (
      <View style={styles.gap}>
        <FormMessage message={getErrorMessage(content.error)} />
        <Button title="Try again" variant="secondary" onPress={() => content.refetch()} />
      </View>
    );
  else if (!canEditCards(board?.role))
    blocker = (
      <InfoNote icon="eye">{'You’re a Viewer on this board, so you can’t add cards.'}</InfoNote>
    );
  else if (!list)
    blocker = (
      <InfoNote icon="alert-circle">
        This list was archived or deleted. Pick another list on the board.
      </InfoNote>
    );
  if (blocker) {
    return (
      <Screen navHeader={header}>
        <View style={styles.top}>{blocker}</View>
      </Screen>
    );
  }

  const submit = () => {
    if (create.isPending) return;
    const trimmed = title.trim();
    if (!trimmed) return setTitleError('Give the card a title.');
    setTitleError(null);
    create.mutate(
      {
        listId,
        input: {
          title: trimmed,
          description: description.trim() || undefined,
          dueAt: dueAt ?? undefined,
        },
        assignees,
        labels: picked,
      },
      {
        onSuccess: (result) => {
          if (result.extrasError) setExtrasError(result.extrasError);
          else close();
        },
      },
    );
  };

  const toggle = <T extends { id: string }>(items: T[], item: T) =>
    items.some((i) => i.id === item.id) ? items.filter((i) => i.id !== item.id) : [...items, item];

  const done = !!extrasError;
  const busy = create.isPending || done;

  return (
    <Screen
      navHeader={header}
      bottomBar={
        done ? (
          <Button title="Done" onPress={close} />
        ) : (
          <Button title="Add card" onPress={submit} loading={create.isPending} />
        )
      }>
      <View style={styles.top}>
        <TextField
          label="Title"
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            if (titleError) setTitleError(null);
          }}
          placeholder="What needs doing?"
          maxLength={200}
          autoFocus
          invalid={!!titleError}
          editable={!busy}
          returnKeyType="next"
        />
        <FormMessage message={titleError} />
      </View>

      <View style={styles.gap8}>
        <AppText variant="label">Description</AppText>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Add more detail"
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={10000}
          editable={!busy}
          accessibilityLabel="Description"
          style={styles.textarea}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.gap8}>
        <AppText variant="label">Assign to</AppText>
        <PickerStatus
          pending={people.isPending}
          error={people.error}
          onRetry={() => people.refetch()}
        />
        {people.assignable ? (
          people.assignable.length ? (
            <PeoplePicker
              people={people.assignable}
              selected={new Set(assignees.map((a) => a.id))}
              onToggle={(p) => setAssignees((cur) => toggle(cur, p))}
              disabled={busy}
            />
          ) : (
            <AppText variant="small">Nobody on this board can be assigned yet.</AppText>
          )
        ) : null}
        <AppText variant="small">Viewers can{'’'}t be assigned.</AppText>
      </View>

      <View style={styles.gap8}>
        <AppText variant="label">Due date</AppText>
        <DueDateField value={dueAt} onChange={setDueAt} disabled={busy} />
      </View>

      <View style={styles.gap8}>
        <AppText variant="label">Labels</AppText>
        <PickerStatus
          pending={labels.isPending}
          error={labels.error}
          onRetry={() => labels.refetch()}
        />
        {labels.data ? (
          <LabelPicker
            boardId={id}
            labels={labels.data}
            selected={new Set(picked.map((l) => l.id))}
            onToggle={(label) => setPicked((cur) => toggle(cur, label))}
            canCreate={canManageLabels(board?.role)}
            disabled={busy}
          />
        ) : null}
      </View>

      <FormMessage message={create.isError ? getErrorMessage(create.error) : extrasError} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: spacing.sm, paddingTop: spacing.lg },
  loading: { marginTop: spacing.xl },
  gap: { gap: spacing.md },
  gap8: { gap: spacing.sm },
  textarea: {
    minHeight: 104,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
  },
});
