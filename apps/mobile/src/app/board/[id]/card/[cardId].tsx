import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage, getErrorStatus } from '@/api/errors';
import type { CardDetail, CardPerson, Label } from '@/api/types';
import { AppText } from '@/components/app-text';
import { BoardAccessRemoved, useBoardAccessLost } from '@/components/board-access';
import { Button } from '@/components/button';
import { LabelChip, Toast } from '@/components/card-ui';
import { Checklist } from '@/components/checklist';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DueDateField } from '@/components/due-date-field';
import { InfoNote } from '@/components/info-note';
import { IconButton } from '@/components/misc';
import { LabelPicker, PickerStatus } from '@/components/pickers';
import { Sheet } from '@/components/sheet';
import { MemberAvatar, RoleBadge } from '@/components/workspace-ui';
import { useBoardContent, useLabels } from '@/hooks/use-board-content';
import { useBoardPeople, type BoardPerson } from '@/hooks/use-board-people';
import { findCachedBoard } from '@/hooks/use-boards';
import {
  useAddChecklistItem,
  useArchiveCard,
  useCard,
  useDeleteChecklistItem,
  useToggleAssignee,
  useToggleCardLabel,
  useUpdateCard,
  useUpdateChecklistItem,
} from '@/hooks/use-cards';
import { canEditCards, canManageLabels } from '@/lib/roles';
import { colors, fonts, radius, spacing } from '@/theme';

// 15 · Card detail. Every change calls its own endpoint and updates both the card and the
// board cache. Viewers see the same screen without any editing controls.
export default function CardDetailScreen() {
  const { id: boardId, cardId } = useLocalSearchParams<{ id: string; cardId: string }>();
  const queryClient = useQueryClient();
  const card = useCard(cardId);
  const content = useBoardContent(boardId);
  const [cached] = useState(() => findCachedBoard(queryClient, boardId));
  const board = content.data?.board;
  const workspaceId = board?.workspaceId ?? cached?.workspaceId;
  const lost = useBoardAccessLost(content.error, workspaceId);

  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);
  const showError = (error: unknown) => setToast(getErrorMessage(error));

  const close = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/board/[id]', params: { id: boardId } });

  // A 404 on the board (not just the card) means our access is gone: 31 · Access removed.
  if (lost) {
    return <BoardAccessRemoved boardName={board?.name ?? cached?.name} workspaceId={workspaceId} />;
  }

  const shell = (
    children: React.ReactNode,
    headerCenter?: React.ReactNode,
    right?: React.ReactNode,
  ) => (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="x" label="Close" onPress={close} />
        <View style={styles.headerCenter}>{headerCenter}</View>
        <View style={styles.headerRight}>{right}</View>
      </View>
      {children}
      <Toast message={toast} onHide={hideToast} />
    </SafeAreaView>
  );

  if (card.isPending) {
    return shell(<ActivityIndicator color={colors.primary} style={styles.loading} />);
  }
  if (card.isError) {
    const gone = getErrorStatus(card.error) === 404;
    return shell(
      <View style={styles.message}>
        <Feather name={gone ? 'file-minus' : 'wifi-off'} size={24} color={colors.muted} />
        <AppText variant="heading" style={styles.center}>
          {gone ? 'This card isn’t available' : 'Couldn’t load this card'}
        </AppText>
        <AppText variant="secondary" style={styles.center}>
          {gone
            ? 'It may have been deleted, or moved to a board you can’t see.'
            : getErrorMessage(card.error)}
        </AppText>
        {gone ? (
          <Button title="Back to board" variant="secondary" onPress={close} />
        ) : (
          <Button
            title="Try again"
            variant="secondary"
            onPress={() => card.refetch()}
            loading={card.isFetching}
          />
        )}
      </View>,
    );
  }

  return (
    <CardBody
      key={card.data.id}
      card={card.data}
      boardId={boardId}
      boardName={board?.name ?? cached?.name ?? ''}
      editable={canEditCards(board?.role)}
      canCreateLabels={canManageLabels(board?.role)}
      shell={shell}
      showError={showError}
      onArchived={close}
    />
  );
}

function CardBody({
  card,
  boardId,
  boardName,
  editable: canEdit,
  canCreateLabels,
  shell,
  showError,
  onArchived,
}: {
  card: CardDetail;
  boardId: string;
  boardName: string;
  editable: boolean;
  canCreateLabels: boolean;
  shell: (
    children: React.ReactNode,
    center?: React.ReactNode,
    right?: React.ReactNode,
  ) => React.ReactNode;
  showError: (error: unknown) => void;
  onArchived: () => void;
}) {
  const archived = !!card.archivedAt;
  const editable = canEdit && !archived;

  const update = useUpdateCard(card.id, boardId);
  const archive = useArchiveCard(card.id, boardId);
  const toggleAssignee = useToggleAssignee(card.id, boardId);
  const toggleLabel = useToggleCardLabel(card.id, boardId);
  const addItem = useAddChecklistItem(card.id, boardId);
  const updateItem = useUpdateChecklistItem(card.id, boardId);
  const deleteItem = useDeleteChecklistItem(card.id, boardId);

  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'members' | 'labels' | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const saveTitle = () => {
    if (title === null) return;
    const next = title.trim();
    setTitle(null);
    if (!next || next === card.title) return;
    update.mutate({ title: next }, { onError: showError });
  };

  const saveDescription = () => {
    if (description === null) return;
    const next = description.trim();
    if (next === (card.description ?? '')) return setDescription(null);
    update.mutate(
      { description: next || null },
      { onSuccess: () => setDescription(null), onError: showError },
    );
  };

  const center = (
    <View style={styles.where} accessibilityLabel={`In ${boardName}, list ${card.list.name}`}>
      <Text style={styles.whereText} numberOfLines={1}>
        {boardName ? `${boardName} · ` : ''}
        {card.list.name}
      </Text>
    </View>
  );

  const right = editable ? (
    <IconButton icon="more-horizontal" label="Card actions" onPress={() => setMenu(true)} />
  ) : null;

  return shell(
    <>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {archived ? (
            <InfoNote icon="archive">
              This card is archived. Restore it from Archived items to edit it.
            </InfoNote>
          ) : null}

          {title !== null ? (
            <TextInput
              value={title}
              onChangeText={setTitle}
              autoFocus
              multiline
              maxLength={200}
              submitBehavior="blurAndSubmit"
              returnKeyType="done"
              onSubmitEditing={saveTitle}
              onBlur={saveTitle}
              accessibilityLabel="Card title"
              style={[styles.title, styles.titleInput]}
            />
          ) : (
            <Pressable
              disabled={!editable}
              onPress={() => setTitle(card.title)}
              accessibilityRole={editable ? 'button' : 'header'}
              accessibilityHint={editable ? 'Tap to rename' : undefined}>
              <Text style={styles.title}>{card.title}</Text>
            </Pressable>
          )}

          <View style={styles.rows}>
            <Row label="Members">
              <View style={styles.inline}>
                {card.assignees.map((p) => (
                  <MemberAvatar key={p.id} name={p.name} seed={p.id} size={30} />
                ))}
                {editable ? (
                  <AddCircle label="Change members" onPress={() => setSheet('members')} />
                ) : !card.assignees.length ? (
                  <AppText variant="secondary">None</AppText>
                ) : null}
              </View>
            </Row>
            <Row label="Labels">
              <View style={styles.inline}>
                {card.labels.map((l) => (
                  <LabelChip key={l.id} label={l} />
                ))}
                {editable ? (
                  <AddCircle label="Change labels" onPress={() => setSheet('labels')} />
                ) : !card.labels.length ? (
                  <AppText variant="secondary">None</AppText>
                ) : null}
              </View>
            </Row>
            <Row label="Due date">
              <DueDateField
                variant="chip"
                value={card.dueAt}
                disabled={!editable}
                onChange={(dueAt) => update.mutate({ dueAt }, { onError: showError })}
              />
            </Row>
          </View>

          <View style={styles.section}>
            <AppText style={styles.heading} accessibilityRole="header">
              Description
            </AppText>
            {description !== null ? (
              <View style={styles.gap}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  autoFocus
                  multiline
                  maxLength={10000}
                  placeholder="Add more detail"
                  placeholderTextColor={colors.placeholder}
                  textAlignVertical="top"
                  accessibilityLabel="Description"
                  style={styles.textarea}
                />
                <View style={styles.actions}>
                  <Button
                    title="Save"
                    onPress={saveDescription}
                    loading={update.isPending}
                    style={styles.smallButton}
                  />
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={() => setDescription(null)}
                    disabled={update.isPending}
                    style={styles.smallButton}
                  />
                </View>
              </View>
            ) : (
              <Pressable
                disabled={!editable}
                onPress={() => setDescription(card.description ?? '')}
                accessibilityHint={editable ? 'Tap to edit the description' : undefined}>
                <AppText
                  variant={card.description ? 'body' : 'secondary'}
                  style={styles.description}>
                  {card.description || (editable ? 'Add a description…' : 'No description.')}
                </AppText>
              </Pressable>
            )}
          </View>

          <Checklist
            items={card.checklistItems}
            editable={editable}
            adding={addItem.isPending}
            onToggle={(item) =>
              updateItem.mutate(
                { itemId: item.id, body: { done: !item.done } },
                { onError: showError },
              )
            }
            onRename={(item, text) =>
              updateItem.mutate({ itemId: item.id, body: { text } }, { onError: showError })
            }
            onDelete={(item) => deleteItem.mutate(item.id, { onError: showError })}
            onAdd={(text, done) => addItem.mutate(text, { onSuccess: done, onError: showError })}
          />

          {editable ? (
            <Button
              title="Archive card"
              icon="archive"
              variant="dangerOutline"
              onPress={() => setConfirmArchive(true)}
              style={styles.archive}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <MembersSheet
        visible={sheet === 'members'}
        onClose={() => setSheet(null)}
        boardId={boardId}
        assigned={card.assignees}
        onToggle={(person, on) => toggleAssignee.mutate({ person, on }, { onError: showError })}
      />
      <LabelsSheet
        visible={sheet === 'labels'}
        onClose={() => setSheet(null)}
        boardId={boardId}
        picked={card.labels}
        canCreate={canCreateLabels}
        onToggle={(label, on) => toggleLabel.mutate({ label, on }, { onError: showError })}
      />

      <Sheet visible={menu} onClose={() => setMenu(false)} title={card.title}>
        <View style={styles.menu}>
          <Button
            title="Archive card"
            icon="archive"
            variant="dangerOutline"
            onPress={() => {
              setMenu(false);
              setConfirmArchive(true);
            }}
          />
        </View>
      </Sheet>

      <ConfirmDialog
        visible={confirmArchive}
        icon="archive"
        title="Archive this card?"
        message="It will be hidden from the board for everyone. You can restore it from Archived items."
        confirmLabel="Archive card"
        loading={archive.isPending}
        error={archive.isError ? getErrorMessage(archive.error) : null}
        onCancel={() => {
          setConfirmArchive(false);
          archive.reset();
        }}
        onConfirm={() =>
          archive.mutate(undefined, {
            onSuccess: () => {
              setConfirmArchive(false);
              onArchived();
            },
          })
        }
      />
    </>,
    center,
    right,
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <AppText variant="secondary" style={styles.rowLabel}>
        {label}
      </AppText>
      <View style={styles.rowValue}>{children}</View>
    </View>
  );
}

function AddCircle({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.addCircle, pressed && { opacity: 0.5 }]}>
      <Feather name="plus" size={16} color={colors.muted} />
    </Pressable>
  );
}

/** Tick people on and off. Choices come from the board's people; Viewers can't be assigned. */
function MembersSheet({
  visible,
  onClose,
  boardId,
  assigned,
  onToggle,
}: {
  visible: boolean;
  onClose: () => void;
  boardId: string;
  assigned: CardPerson[];
  onToggle: (person: CardPerson, on: boolean) => void;
}) {
  const content = useBoardContent(boardId);
  const people = useBoardPeople(content.data?.board);
  const ids = new Set(assigned.map((p) => p.id));
  // People assigned earlier who can't be assigned now (e.g. made a Viewer) still show, to unassign.
  const extra = assigned.filter((p) => !people.assignable?.some((a) => a.id === p.id));
  const rows: (BoardPerson | (CardPerson & { role?: undefined }))[] = [
    ...(people.assignable ?? []),
    ...extra,
  ];
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Members"
      subtitle="Viewers can’t be assigned.">
      <ScrollView contentContainerStyle={styles.sheetList}>
        <PickerStatus
          pending={people.isPending}
          error={people.error}
          onRetry={() => people.refetch()}
        />
        {people.assignable
          ? rows.map((p) => {
              const on = ids.has(p.id);
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={p.name}
                  onPress={() => onToggle({ id: p.id, name: p.name, avatarUrl: p.avatarUrl }, !on)}
                  style={({ pressed }) => [
                    styles.personRow,
                    pressed && { backgroundColor: colors.background },
                  ]}>
                  <MemberAvatar name={p.name} seed={p.id} size={34} />
                  <Text style={styles.personName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  {p.role ? <RoleBadge role={p.role} /> : null}
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on ? <Feather name="check" size={14} color={colors.surface} /> : null}
                  </View>
                </Pressable>
              );
            })
          : null}
      </ScrollView>
      <View style={styles.sheetFooter}>
        <Button title="Done" variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}

function LabelsSheet({
  visible,
  onClose,
  boardId,
  picked,
  canCreate,
  onToggle,
}: {
  visible: boolean;
  onClose: () => void;
  boardId: string;
  picked: Label[];
  canCreate: boolean;
  onToggle: (label: Label, on: boolean) => void;
}) {
  const labels = useLabels(boardId);
  const ids = new Set(picked.map((l) => l.id));
  return (
    <Sheet visible={visible} onClose={onClose} title="Labels">
      <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
        <PickerStatus
          pending={labels.isPending}
          error={labels.error}
          onRetry={() => labels.refetch()}
        />
        {labels.data ? (
          <LabelPicker
            boardId={boardId}
            labels={labels.data}
            selected={ids}
            canCreate={canCreate}
            onToggle={(label) => onToggle(label, !ids.has(label.id))}
          />
        ) : null}
        <Button title="Done" variant="secondary" onPress={onClose} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { minWidth: 44, alignItems: 'flex-end' },
  where: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    height: 36,
    maxWidth: '100%',
  },
  whereText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, flexShrink: 1 },
  loading: { marginTop: spacing.xxl },
  message: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  center: { textAlign: 'center' },
  content: { padding: spacing.lg + 2, gap: spacing.xl, paddingBottom: spacing.xxl },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, color: colors.ink },
  titleInput: { borderBottomWidth: 1, borderBottomColor: colors.primary, paddingVertical: 2 },
  rows: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  rowLabel: { width: 96, fontSize: 15 },
  rowValue: { flex: 1 },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  addCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { gap: spacing.sm },
  heading: { fontFamily: fonts.semibold, fontSize: 15 },
  description: { fontSize: 15, lineHeight: 22 },
  gap: { gap: spacing.sm },
  textarea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.control,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  smallButton: { height: 40, paddingHorizontal: 18 },
  archive: { marginTop: spacing.sm },
  menu: { padding: spacing.lg },
  sheetList: { paddingVertical: spacing.sm },
  sheetBody: { padding: spacing.lg, gap: spacing.lg },
  sheetFooter: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg + 2,
  },
  personName: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
