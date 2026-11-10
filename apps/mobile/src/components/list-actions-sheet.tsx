import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import type { BoardList } from '@/api/types';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormMessage } from '@/components/misc';
import { Sheet, SheetDivider, SheetRow } from '@/components/sheet';
import { TextField } from '@/components/text-field';
import { useArchiveList, useRenameList } from '@/hooks/use-lists';
import { useMoveList } from '@/hooks/use-move';
import { plural } from '@/lib/format';
import { colors, fonts, spacing } from '@/theme';

type View_ = 'menu' | 'rename' | 'move';

/** 25 · List actions: add card, rename, move to another position, archive (with 27 · Confirm). */
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
        visible={!!list && !confirm}
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
            <SheetDivider />
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
