import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import type { BoardList } from '@/api/types';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormMessage } from '@/components/misc';
import { Sheet, SheetDivider, SheetRow } from '@/components/sheet';
import { TextField } from '@/components/text-field';
import type { CardSort } from '@/api/lists';
import {
  useArchiveList,
  useArchiveListCards,
  useRenameList,
  useSortCards,
} from '@/hooks/use-lists';
import { useMoveList } from '@/hooks/use-move';
import { plural } from '@/lib/format';
import { colors, fonts, spacing } from '@/theme';

type View_ = 'menu' | 'rename' | 'move' | 'sort';

const SORTS: { by: CardSort; label: string }[] = [
  { by: 'dueAt', label: 'Due date (soonest first)' },
  { by: 'title', label: 'Name (A to Z)' },
  { by: 'newest', label: 'Newest first' },
  { by: 'oldest', label: 'Oldest first' },
];

/**
 * 25 · List actions: add card, rename, move to another position, sort the cards once, archive all
 * its cards, archive the list (the archives with 27 · Confirm).
 */
export function ListActionsSheet({
  list,
  index,
  total,
  boardId,
  boardName,
  onClose,
  onAddCard,
  onError,
}: {
  /** The list the sheet is for; null hides the sheet. */
  list: BoardList | null;
  index: number;
  total: number;
  boardId: string;
  boardName: string;
  onClose: () => void;
  onAddCard: (list: BoardList) => void;
  /** Shows an error on the board (used for moves, which finish after the sheet closes). */
  onError: (error: unknown) => void;
}) {
  const rename = useRenameList(boardId);
  const archive = useArchiveList(boardId);
  const move = useMoveList(boardId);
  const sort = useSortCards(boardId);
  const archiveCards = useArchiveListCards(boardId);
  const [confirmCards, setConfirmCards] = useState<BoardList | null>(null);
  const [view, setView] = useState<View_>('menu');
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState(false);
  // The list being archived, kept while the dialog is open even if the sheet's list changes.
  const [archiving, setArchiving] = useState<BoardList | null>(null);

  const close = () => {
    setView('menu');
    rename.reset();
    onClose();
  };

  const saveName = () => {
    if (!list) return;
    const trimmed = name.trim();
    if (!trimmed || rename.isPending) return;
    if (trimmed === list.name) return close();
    rename.mutate({ listId: list.id, name: trimmed }, { onSuccess: close });
  };

  return (
    <>
      <Sheet
        visible={!!list && !confirm && !confirmCards}
        onClose={close}
        dismissable={!rename.isPending}
        title={list?.name}
        subtitle={list ? `${plural(list.cards.length, 'card')} · ${boardName}` : undefined}>
        {list && view === 'menu' ? (
          <View style={styles.menu}>
            <SheetRow
              icon="plus"
              label="Add card"
              onPress={() => {
                close();
                onAddCard(list);
              }}
            />
            <SheetRow
              icon="edit-2"
              label="Rename list"
              onPress={() => {
                setName(list.name);
                setView('rename');
              }}
            />
            <SheetRow
              icon="arrow-right"
              label="Move list"
              value={`Position ${index + 1} of ${total}`}
              disabled={total < 2}
              onPress={() => setView('move')}
            />
            <SheetRow
              icon="bar-chart-2"
              label="Sort cards"
              value="Manual"
              disabled={list.cards.length < 2}
              onPress={() => setView('sort')}
            />
            <SheetDivider />
            <SheetRow
              icon="archive"
              label="Archive all cards in list"
              disabled={list.cards.length === 0}
              onPress={() => setConfirmCards(list)}
            />
            <SheetRow
              icon="archive"
              label="Archive list"
              danger
              onPress={() => {
                setArchiving(list);
                setConfirm(true);
              }}
            />
          </View>
        ) : null}

        {list && view === 'rename' ? (
          <View style={styles.form}>
            <TextField
              label="List name"
              value={name}
              onChangeText={setName}
              maxLength={100}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveName}
              selectTextOnFocus
            />
            <FormMessage message={rename.isError ? getErrorMessage(rename.error) : null} />
            <Button
              title="Save"
              onPress={saveName}
              loading={rename.isPending}
              disabled={!name.trim()}
            />
            <Button
              title="Back"
              variant="text"
              onPress={() => setView('menu')}
              disabled={rename.isPending}
            />
          </View>
        ) : null}

        {list && view === 'sort' ? (
          <ScrollView contentContainerStyle={styles.positions}>
            <Text style={styles.sortNote}>
              Puts the cards in this order once. You can still drag them afterwards.
            </Text>
            {SORTS.map((option) => (
              <Pressable
                key={option.by}
                accessibilityRole="button"
                onPress={() => {
                  sort.mutate({ listId: list.id, by: option.by }, { onError });
                  close();
                }}
                style={({ pressed }) => [styles.position, pressed && { opacity: 0.6 }]}>
                <Text style={styles.positionText}>{option.label}</Text>
              </Pressable>
            ))}
            <Button title="Back" variant="text" onPress={() => setView('menu')} />
          </ScrollView>
        ) : null}

        {list && view === 'move' ? (
          <ScrollView contentContainerStyle={styles.positions}>
            {Array.from({ length: total }, (_, i) => {
              const current = i === index;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: current }}
                  onPress={() => {
                    if (!current) move.mutate({ listId: list.id, index: i }, { onError });
                    close();
                  }}
                  style={({ pressed }) => [
                    styles.position,
                    current && styles.positionCurrent,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <View style={[styles.radio, current && styles.radioOn]}>
                    {current ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={[styles.positionText, current && { fontFamily: fonts.semibold }]}>
                    Position {i + 1}
                    {i === 0 ? ' (first)' : i === total - 1 ? ' (last)' : ''}
                  </Text>
                  {current ? <Text style={styles.currentTag}>current</Text> : null}
                </Pressable>
              );
            })}
            <Button title="Back" variant="text" onPress={() => setView('menu')} />
          </ScrollView>
        ) : null}
      </Sheet>

      <ConfirmDialog
        visible={!!confirmCards}
        icon="archive"
        title={`Archive all cards in ${confirmCards?.name ?? 'this list'}?`}
        message={`${plural(confirmCards?.cards.length ?? 0, 'card')} will be hidden from the board for everyone. The list stays. You can restore the cards from Archived items.`}
        confirmLabel="Archive cards"
        loading={archiveCards.isPending}
        error={archiveCards.isError ? getErrorMessage(archiveCards.error) : null}
        onCancel={() => {
          setConfirmCards(null);
          archiveCards.reset();
        }}
        onConfirm={() =>
          confirmCards &&
          archiveCards.mutate(confirmCards.id, {
            onSuccess: () => {
              setConfirmCards(null);
              close();
            },
          })
        }
      />

      <ConfirmDialog
        visible={confirm}
        icon="archive"
        title={`Archive the ${archiving?.name ?? ''} list?`}
        message={`The list and its ${plural(archiving?.cards.length ?? 0, 'card')} will be hidden from the board for everyone. You can restore them from Archived items.`}
        confirmLabel="Archive list"
        loading={archive.isPending}
        error={archive.isError ? getErrorMessage(archive.error) : null}
        onCancel={() => {
          setConfirm(false);
          archive.reset();
        }}
        onConfirm={() =>
          archiving &&
          archive.mutate(archiving.id, {
            onSuccess: () => {
              setConfirm(false);
              close();
            },
          })
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  menu: { paddingVertical: spacing.xs },
  form: { padding: spacing.lg, gap: spacing.md },
  positions: { padding: spacing.lg, gap: spacing.sm },
  sortNote: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  position: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  positionCurrent: { borderColor: colors.primary, backgroundColor: '#F4F7FF' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  positionText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  currentTag: { fontSize: 13, color: colors.muted },
});
