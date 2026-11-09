import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Board, BoardVisibility } from '@/api/types';
import { AppText } from '@/components/app-text';
import { ROLE_LABEL } from '@/lib/roles';
import { colors, fonts, radius, spacing } from '@/theme';

/** Background swatches from 09 · Create board. The first one is the API default. */
export const BOARD_COLORS = ['#2F5BEA', '#12936A', '#E8833A', '#D9435A', '#8B5CF6', '#4B5160'];

export const VISIBILITY_LABEL: Record<BoardVisibility, string> = {
  WORKSPACE: 'Workspace',
  PRIVATE: 'Private',
};

/** One tile in the 08 · Workspace boards grid: colour band, name, meta line, lock if private. */
export function BoardCard({
  board,
  width,
  onPress,
}: {
  board: Board;
  width: number;
  onPress: () => void;
}) {
  const isPrivate = board.visibility === 'PRIVATE';
  const meta = `${VISIBILITY_LABEL[board.visibility]} · ${ROLE_LABEL[board.role]}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${board.name}, ${isPrivate ? 'private board' : 'workspace board'}, you're ${ROLE_LABEL[board.role]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}>
      <View style={[styles.band, { backgroundColor: board.color }]}>
        {isPrivate ? <Feather name="lock" size={14} color={colors.surface} /> : null}
      </View>
      <View style={styles.cardBody}>
        <AppText style={styles.cardName} numberOfLines={1}>
          {board.name}
        </AppText>
        <AppText variant="small" style={styles.cardMeta} numberOfLines={1}>
          {meta}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Dashed "+ New board" tile at the end of the grid. */
export function NewBoardTile({ width, onPress }: { width: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New board"
      onPress={onPress}
      style={({ pressed }) => [styles.newTile, { width }, pressed && styles.pressed]}>
      <Feather name="plus" size={20} color={colors.primary} />
      <Text style={styles.newText}>New board</Text>
    </Pressable>
  );
}

/** Row of colour squares; the selected one gets a dark ring. */
export function ColorSwatches({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  // Keep a colour set through the API (not one of ours) selectable and visible.
  const options = BOARD_COLORS.some((c) => c.toLowerCase() === value.toLowerCase())
    ? BOARD_COLORS
    : [value, ...BOARD_COLORS];
  return (
    <View accessibilityRole="radiogroup" style={styles.swatches}>
      {options.map((color, index) => {
        const selected = color.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={color}
            accessibilityRole="radio"
            accessibilityLabel={`Colour ${index + 1}`}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(color)}
            hitSlop={4}
            style={[styles.swatchRing, selected && styles.swatchRingOn]}>
            <View style={[styles.swatch, { backgroundColor: color }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Radio cards for Workspace / Private (09 · Create board). */
export function VisibilityOptions({
  value,
  onChange,
  workspaceName,
}: {
  value: BoardVisibility;
  onChange: (v: BoardVisibility) => void;
  workspaceName: string;
}) {
  const descriptions: Record<BoardVisibility, string> = {
    WORKSPACE: `Everyone in ${workspaceName} can see this board.`,
    PRIVATE: 'Only people you add to the board can see it.',
  };
  return (
    <View accessibilityRole="radiogroup" style={styles.options}>
      {(['WORKSPACE', 'PRIVATE'] as const).map((v) => {
        const selected = v === value;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${VISIBILITY_LABEL[v]}. ${descriptions[v]}`}
            onPress={() => onChange(v)}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              pressed && styles.pressed,
            ]}>
            <View style={[styles.radio, selected && styles.radioOn]}>
              {selected ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={styles.flex}>
              <AppText style={styles.optionTitle}>{VISIBILITY_LABEL[v]}</AppText>
              <AppText variant="small">{descriptions[v]}</AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Two-button Workspace | Private switch (17 · Board settings). */
export function VisibilitySegment({
  value,
  onChange,
  disabled,
}: {
  value: BoardVisibility;
  onChange: (v: BoardVisibility) => void;
  disabled?: boolean;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.segment}>
      {(['WORKSPACE', 'PRIVATE'] as const).map((v) => {
        const selected = v === value;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(v)}
            style={[styles.segmentItem, selected && styles.segmentOn]}>
            <Text style={[styles.segmentText, selected && styles.segmentTextOn]}>
              {VISIBILITY_LABEL[v]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  band: { height: 46, alignItems: 'flex-end', padding: spacing.sm },
  cardBody: { paddingHorizontal: 10, paddingVertical: spacing.sm, gap: 1 },
  cardName: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19 },
  cardMeta: { fontSize: 12, lineHeight: 16 },
  newTile: {
    minHeight: 97,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  newText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatchRing: { padding: 3, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  swatchRingOn: { borderColor: colors.ink },
  swatch: { width: 30, height: 30, borderRadius: 7 },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: '#F4F7FF' },
  optionTitle: { fontFamily: fonts.semibold, fontSize: 15 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segmentItem: {
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentOn: { backgroundColor: colors.primary },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  segmentTextOn: { color: colors.surface, fontFamily: fonts.semibold },
});
