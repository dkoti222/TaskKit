import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';

import type { BoardList, CardSummary } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { CardFace } from '@/components/card-ui';
import { FormMessage, IconButton } from '@/components/misc';
import { TextField } from '@/components/text-field';
import { colors, fonts, radius, spacing } from '@/theme';

export const COLUMN_GAP = 10;

/**
 * One list on the board: header (long-press to drag the list), its cards (long-press to drag
 * a card up or down), and "Add card" at the bottom.
 */
export function ListColumn({
  list,
  cards,
  width,
  maxHeight,
  editable,
  dragCards,
  onDragList,
  listActive,
  onMoveCard,
  onCardPress,
  onAddCard,
  onMenu,
  filtered,
}: {
  list: BoardList;
  /** The cards to show (may be filtered). */
  cards: CardSummary[];
  width: number;
  maxHeight: number;
  /** Shows the list menu and "Add card". */
  editable: boolean;
  /** Long-press drag of cards (off for Viewers and while a filter is on). */
  dragCards: boolean;
  /** Starts dragging this list (from the outer list of lists). */
  onDragList?: () => void;
  listActive?: boolean;
  /** A card was dropped at `index` in this list. */
  onMoveCard: (card: CardSummary, index: number) => void;
  onCardPress?: (card: CardSummary) => void;
  onAddCard?: () => void;
  onMenu?: () => void;
  filtered?: boolean;
}) {
  // DraggableFlatList wants its new order on the same frame the finger lifts, but our cache
  // update is async (onMutate). Keep the dropped order until `cards` changes (optimistic update
  // or rollback), so the card doesn't flash back to its old place.
  const [override, setOverride] = useState<{ source: CardSummary[]; data: CardSummary[] } | null>(
    null,
  );
  const data = override && override.source === cards ? override.data : cards;

  return (
    <View
      style={[styles.column, { width, maxHeight }, listActive && styles.columnActive]}
      accessibilityLabel={`${list.name}, ${list.cards.length} cards`}>
      <Pressable
        onLongPress={onDragList}
        delayLongPress={300}
        disabled={!onDragList}
        accessibilityRole="header"
        accessibilityHint={onDragList ? 'Long-press to drag this list left or right' : undefined}
        style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {list.name} <Text style={styles.count}>{list.cards.length}</Text>
        </Text>
        {editable && onMenu ? (
          <IconButton
            icon="more-horizontal"
            label={`${list.name} list actions`}
            onPress={onMenu}
            color={colors.muted}
          />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </Pressable>

      <DraggableFlatList
        data={data}
        keyExtractor={(card) => card.id}
        activationDistance={12}
        containerStyle={styles.cardsContainer}
        contentContainerStyle={styles.cards}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, drag, isActive }) => (
          <ScaleDecorator activeScale={1.03}>
            <View style={styles.cardCell}>
              <CardFace
                card={item}
                active={isActive}
                onPress={onCardPress ? () => onCardPress(item) : undefined}
                onLongPress={dragCards ? drag : undefined}
              />
            </View>
          </ScaleDecorator>
        )}
        onDragEnd={({ data: next, from, to }) => {
          if (from === to) return;
          setOverride({ source: cards, data: next });
          onMoveCard(next[to], to);
        }}
        ListEmptyComponent={
          <AppText variant="small" style={styles.empty}>
            {filtered ? 'No matching cards' : 'No cards yet'}
          </AppText>
        }
      />

      {editable && onAddCard ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add a card to ${list.name}`}
          onPress={onAddCard}
          style={({ pressed }) => [styles.addCard, pressed && { opacity: 0.6 }]}>
          <Feather name="plus" size={18} color={colors.muted} />
          <Text style={styles.addCardText}>Add card</Text>
        </Pressable>
      ) : (
        <View style={styles.bottomSpacer} />
      )}
    </View>
  );
}

/** "+ Add a list" at the end of the board. Opens into a name field; stays open to add several. */
export function AddListTile({
  width,
  onAdd,
  pending,
  error,
}: {
  width: number;
  onAdd: (name: string, done: () => void) => void;
  pending: boolean;
  error: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.addList, { width }, pressed && { opacity: 0.6 }]}>
        <Feather name="plus" size={18} color={colors.ink} />
        <Text style={styles.addListText}>Add a list</Text>
      </Pressable>
    );
  }

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    onAdd(trimmed, () => setName(''));
  };

  return (
    <View style={[styles.column, styles.addListOpen, { width }]}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="List name"
        placeholderTextColor={colors.placeholder}
        autoFocus
        maxLength={100}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={submit}
        accessibilityLabel="List name"
        style={styles.addListInput}
      />
      <FormMessage message={error} />
      <View style={styles.addListActions}>
        <Button
          title="Add list"
          onPress={submit}
          loading={pending}
          disabled={!name.trim()}
          style={styles.addListButton}
        />
        <IconButton
          icon="x"
          label="Cancel"
          onPress={() => {
            setOpen(false);
            setName('');
          }}
        />
      </View>
    </View>
  );
}

const STARTER_SETS = [
  { names: ['To do', 'Doing', 'Done'], note: 'Simple task flow' },
  { names: ['Backlog', 'In progress', 'Review', 'Done'], note: 'For software teams' },
];

/** 29 · Empty state: new board. Add the first list, or start from a set of lists. */
export function FirstListCard({
  color,
  onAdd,
  pending,
  error,
}: {
  color: string;
  onAdd: (names: string[]) => void;
  pending: boolean;
  error: string | null;
}) {
  const [name, setName] = useState('');
  const submit = () => {
    if (name.trim() && !pending) onAdd([name.trim()]);
  };
  return (
    <View style={styles.first}>
      <View style={styles.firstCard}>
        <View style={[styles.firstIcon, { backgroundColor: `${color}1F` }]}>
          <Feather name="trello" size={22} color={color} />
        </View>
        <AppText variant="heading" style={styles.center} accessibilityRole="header">
          Add your first list
        </AppText>
        <AppText variant="small" style={styles.center}>
          Lists are the stages your work moves through, like To do, Doing and Done.
        </AppText>
        <View style={styles.firstForm}>
          <TextField
            label="List name"
            placeholder="To do"
            value={name}
            onChangeText={setName}
            maxLength={100}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <FormMessage message={error} />
          <Button title="Add list" onPress={submit} loading={pending} disabled={!name.trim()} />
        </View>
      </View>

      <AppText variant="label" style={styles.setsTitle}>
        Or start from a set
      </AppText>
      {STARTER_SETS.map((set) => (
        <Pressable
          key={set.note}
          accessibilityRole="button"
          accessibilityLabel={`Add lists ${set.names.join(', ')}. ${set.note}`}
          disabled={pending}
          onPress={() => onAdd(set.names)}
          style={({ pressed }) => [styles.setRow, pressed && { opacity: 0.6 }]}>
          <Text style={styles.setNames}>{set.names.join(' · ')}</Text>
          <AppText variant="small">{set.note}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radius.card,
    marginRight: COLUMN_GAP,
    overflow: 'hidden',
  },
  columnActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.xs,
    minHeight: 48,
  },
  headerSpacer: { height: 44 },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  count: { fontFamily: fonts.regular, color: colors.muted },
  cardsContainer: { flexShrink: 1 },
  cards: { paddingHorizontal: spacing.md },
  cardCell: { paddingBottom: spacing.sm },
  empty: { paddingVertical: spacing.sm, paddingHorizontal: 2 },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md + 2,
    marginBottom: spacing.xs,
  },
  addCardText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  bottomSpacer: { height: spacing.xs },
  addList: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.card,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(22,24,29,0.2)',
  },
  addListText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  addListOpen: { backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  addListInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
  },
  addListActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addListButton: { flex: 1, height: 44 },
  first: { padding: spacing.lg, gap: spacing.sm },
  firstCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  firstIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  center: { textAlign: 'center' },
  firstForm: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.sm },
  setsTitle: { marginTop: spacing.md, color: colors.muted },
  setRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
  },
  setNames: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
