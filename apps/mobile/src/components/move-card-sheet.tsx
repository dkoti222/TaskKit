import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { BoardList } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { useMoveCard } from '@/hooks/use-move';
import { colors, fonts, radius, spacing } from '@/theme';

/**
 * 26 · Move card: pick a list and Top/Bottom, then PATCH /cards/:id/move. The move is optimistic
 * (the sheet closes straight away); a refusal rolls back and is reported through `onError`.
 * The API only moves cards within the same board, so the board is shown but can't be changed.
 */
export function MoveCardSheet({
  visible,
  onClose,
  boardId,
  boardName,
  lists,
  card,
  onError,
}: {
  visible: boolean;
  onClose: () => void;
  boardId: string;
  boardName: string;
  lists: BoardList[];
  card: { id: string; title: string; version: number; listId: string };
  onError: (error: unknown) => void;
}) {
  const move = useMoveCard(boardId);
  const current = lists.find((l) => l.id === card.listId);
  const [listId, setListId] = useState<string | null>(null);
  const [where, setWhere] = useState<'top' | 'bottom'>('top');

  // Default to the first list the card isn't in (as in the design), or its own list.
  const selectedId = listId ?? lists.find((l) => l.id !== card.listId)?.id ?? card.listId;
  const target = lists.find((l) => l.id === selectedId);
  const siblings = target?.cards.filter((c) => c.id !== card.id) ?? [];
  const index = where === 'top' ? 0 : siblings.length;
  // Moving to where it already is would be a no-op (and still bump the version).
  const currentIndex = target?.cards.findIndex((c) => c.id === card.id) ?? -1;
  const noChange = selectedId === card.listId && currentIndex === index;

  const close = () => {
    setListId(null);
    setWhere('top');
    onClose();
  };

  const submit = () => {
    if (!target || noChange) return;
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
          <View style={styles.select} accessibilityLabel={`Board ${boardName}`}>
            <Text style={styles.selectText} numberOfLines={1}>
              {boardName}
            </Text>
            <Feather name="lock" size={14} color={colors.placeholder} />
          </View>
          <AppText variant="small">Cards can be moved between lists on this board.</AppText>
        </View>

        <View style={styles.field}>
          <AppText variant="label" style={styles.label}>
            List
          </AppText>
          <View accessibilityRole="radiogroup" style={styles.options}>
            {lists.map((list) => {
              const on = list.id === selectedId;
              return (
                <Pressable
                  key={list.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={
                    list.id === card.listId ? `${list.name}, current list` : list.name
                  }
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
                  {list.id === card.listId ? <Text style={styles.current}>current</Text> : null}
                </Pressable>
              );
            })}
          </View>
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

        <Button
          title={noChange ? 'Already here' : `Move to ${target?.name ?? ''}`}
          onPress={submit}
          disabled={!target || noChange}
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
});
