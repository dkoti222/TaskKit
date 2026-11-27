import Feather from '@expo/vector-icons/Feather';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { moveCard } from '@/api/cards';
import { getErrorMessage } from '@/api/errors';
import type { BoardList } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { useBoardContent } from '@/hooks/use-board-content';
import { boardKeys, useBoards } from '@/hooks/use-boards';
import { cardKeys } from '@/hooks/use-cards';
import { useMoveCard } from '@/hooks/use-move';
import { canEditCards } from '@/lib/roles';
import { useRealtime } from '@/realtime/socket';
import { colors, fonts, radius, spacing } from '@/theme';

/**
 * 26 · Move card: pick a board, a list and Top/Bottom, then PATCH /cards/:id/move.
 * - Same board: optimistic (the sheet closes straight away); a refusal rolls back and is
 *   reported through `onError`.
 * - Another board of the workspace (where you're Owner, Admin or Member): waits for the API,
 *   because the card loses its labels and people who can't use that board. `onMovedToBoard`
 *   then takes over (the card now lives on the other board).
 */
export function MoveCardSheet({
  visible,
  onClose,
  boardId,
  boardName,
  workspaceId,
  lists,
  card,
  onError,
  onMovedToBoard,
}: {
  visible: boolean;
  onClose: () => void;
  boardId: string;
  boardName: string;
  workspaceId?: string;
  lists: BoardList[];
  card: { id: string; title: string; version: number; listId: string };
  onError: (error: unknown) => void;
  onMovedToBoard?: (boardId: string) => void;
}) {
  const queryClient = useQueryClient();
  const move = useMoveCard(boardId);
  // Moves need a connection (screen 30): their position and version depend on others' changes.
  const online = useRealtime((s) => s.online);
  const [targetBoardId, setTargetBoardId] = useState(boardId);
  const [pickingBoard, setPickingBoard] = useState(false);
  const [listId, setListId] = useState<string | null>(null);
  const [where, setWhere] = useState<'top' | 'bottom'>('top');

  // Boards you can add cards to (the card's own board always first).
  const boards = useBoards(workspaceId ?? '');
  const boardChoices = (boards.data ?? []).filter((b) => b.id === boardId || canEditCards(b.role));
  const crossBoard = targetBoardId !== boardId;
  const otherContent = useBoardContent(crossBoard ? targetBoardId : '');
  const targetLists = crossBoard ? (otherContent.data?.lists ?? []) : lists;
  const targetBoardName = crossBoard
    ? (boardChoices.find((b) => b.id === targetBoardId)?.name ?? '')
    : boardName;
  const current = lists.find((l) => l.id === card.listId);

  // Default to the first list the card isn't in (as in the design), or its own list.
  const selectedId =
    (listId && targetLists.some((l) => l.id === listId) ? listId : null) ??
    targetLists.find((l) => l.id !== card.listId)?.id ??
    targetLists[0]?.id ??
    null;
  const target = targetLists.find((l) => l.id === selectedId);
  const siblings = target?.cards.filter((c) => c.id !== card.id) ?? [];
  const index = where === 'top' ? 0 : siblings.length;
  // Moving to where it already is would be a no-op (and still bump the version).
  const currentIndex = target?.cards.findIndex((c) => c.id === card.id) ?? -1;
  const noChange = !crossBoard && selectedId === card.listId && currentIndex === index;

  const moveAway = useMutation({
    mutationFn: () => moveCard(card.id, { listId: selectedId!, index, version: card.version }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.content(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.content(targetBoardId) });
      void queryClient.invalidateQueries({ queryKey: cardKeys.detail(card.id) });
    },
  });

  const close = () => {
    setListId(null);
    setWhere('top');
    setTargetBoardId(boardId);
    setPickingBoard(false);
    moveAway.reset();
    onClose();
  };

  const submit = () => {
    if (!target || noChange) return;
    if (crossBoard) {
      const to = targetBoardId;
      moveAway.mutate(undefined, {
        onSuccess: () => {
          close();
          onMovedToBoard?.(to);
        },
      });
      return;
    }
    move.mutate({ cardId: card.id, listId: target.id, index, version: card.version }, { onError });
    close();
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Move card"
      subtitle={`${card.title} · now in ${boardName} / ${current?.name ?? '…'}`}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.field}>
          <AppText variant="label" style={styles.label}>
            Board
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Board ${targetBoardName}. Change board`}
            disabled={boardChoices.length < 2}
            onPress={() => setPickingBoard(!pickingBoard)}
            style={styles.select}>
            <Text style={styles.selectText} numberOfLines={1}>
              {targetBoardName}
            </Text>
            {boardChoices.length > 1 ? (
              <Feather
                name={pickingBoard ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.muted}
              />
            ) : null}
          </Pressable>
          {pickingBoard ? (
            <View accessibilityRole="radiogroup" style={styles.options}>
              {boardChoices.map((b) => {
                const on = b.id === targetBoardId;
                return (
                  <Pressable
                    key={b.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      setTargetBoardId(b.id);
                      setListId(null);
                      setPickingBoard(false);
                    }}
                    style={[styles.option, on && styles.optionOn]}>
                    <View style={[styles.boardDot, { backgroundColor: b.color }]} />
                    <Text style={styles.optionText} numberOfLines={1}>
                      {b.name}
                    </Text>
                    {b.id === boardId ? <Text style={styles.current}>current</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {crossBoard ? (
            <AppText variant="small">
              Labels are removed (they belong to a board), and so are people who can’t edit that
              board.
            </AppText>
          ) : null}
        </View>

        <View style={styles.field}>
          <AppText variant="label" style={styles.label}>
            List
          </AppText>
          {crossBoard && otherContent.isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : !targetLists.length ? (
            <AppText variant="small">That board has no lists yet.</AppText>
          ) : (
            <View accessibilityRole="radiogroup" style={styles.options}>
              {targetLists.map((list) => {
                const on = list.id === selectedId;
                const isCurrent = !crossBoard && list.id === card.listId;
                return (
                  <Pressable
                    key={list.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={isCurrent ? `${list.name}, current list` : list.name}
                    onPress={() => setListId(list.id)}
                    style={({ pressed }) => [
                      styles.option,
                      on && styles.optionOn,
                      pressed && { opacity: 0.7 },
                    ]}>
                    <View style={[styles.radio, on && styles.radioOn]}>
                      {on ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text
                      style={[styles.optionText, on && { fontFamily: fonts.semibold }]}
                      numberOfLines={1}>
                      {list.name}
                    </Text>
                    {isCurrent ? <Text style={styles.current}>current</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.positionRow}>
          <AppText variant="label" style={styles.label}>
            Position
          </AppText>
          <View accessibilityRole="radiogroup" style={styles.segment}>
            {(['top', 'bottom'] as const).map((value) => {
              const on = where === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setWhere(value)}
                  style={[styles.segmentItem, on && styles.segmentOn]}>
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                    {value === 'top' ? 'Top' : 'Bottom'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {moveAway.isError ? (
          <AppText variant="small" style={{ color: colors.danger }}>
            {getErrorMessage(moveAway.error)}
          </AppText>
        ) : null}

        {!online ? (
          <AppText variant="small">
            Moving cards needs a connection. Try again when you’re online.
          </AppText>
        ) : null}
        <Button
          title={noChange ? 'Already here' : `Move to ${target?.name ?? ''}`}
          onPress={submit}
          loading={moveAway.isPending}
          disabled={!target || noChange || !online}
          style={styles.submit}
        />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { color: colors.muted },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.background,
  },
  selectText: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, flex: 1 },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: '#F4F7FF' },
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
  optionText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  current: { fontSize: 13, color: colors.muted },
  positionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: 3,
    gap: 3,
  },
  segmentItem: { paddingHorizontal: 16, height: 34, justifyContent: 'center', borderRadius: 7 },
  segmentOn: { backgroundColor: colors.primary },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  segmentTextOn: { color: colors.surface, fontFamily: fonts.semibold },
  submit: { marginTop: spacing.sm },
  boardDot: { width: 12, height: 12, borderRadius: 3 },
});
