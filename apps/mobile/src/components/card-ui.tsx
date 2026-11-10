import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CardPerson, CardSummary, Label } from '@/api/types';
import { AppText } from '@/components/app-text';
import { MemberAvatar } from '@/components/workspace-ui';
import { dueState, shortDate, shade, tint } from '@/lib/format';
import { colors, fonts, spacing } from '@/theme';

/** Soft chip in the label's colour (Backend, Bug, …). */
export function LabelChip({
  label,
  size = 'small',
  selected,
  onPress,
}: {
  label: Pick<Label, 'name' | 'color'>;
  size?: 'small' | 'large';
  /** Picker state: selected chips get a border in the label colour. */
  selected?: boolean;
  onPress?: () => void;
}) {
  const large = size === 'large';
  const chip = (
    <View
      style={[
        styles.label,
        large && styles.labelLarge,
        { backgroundColor: tint(label.color, 0.86) },
        selected !== undefined && {
          borderWidth: 1.5,
          borderColor: selected ? shade(label.color, 0.1) : 'transparent',
        },
      ]}>
      <Text
        style={[
          styles.labelText,
          large && styles.labelTextLarge,
          { color: shade(label.color, 0.35) },
        ]}
        numberOfLines={1}>
        {label.name}
      </Text>
    </View>
  );
  if (!onPress) return chip;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      accessibilityLabel={`Label ${label.name}`}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {chip}
    </Pressable>
  );
}

const DUE_LOOK = {
  overdue: { bg: colors.dangerSoft, text: colors.danger },
  soon: { bg: '#FDEEE2', text: '#B5561A' },
  later: { bg: '#EEF0F3', text: colors.muted },
};

/** Due date chip on a card: "Overdue" in red, due within 48h in orange, later in grey. */
export function DueChip({ dueAt }: { dueAt: string }) {
  const state = dueState(dueAt);
  const look = DUE_LOOK[state];
  return (
    <View style={[styles.due, { backgroundColor: look.bg }]}>
      <Feather name="clock" size={12} color={look.text} />
      <Text style={[styles.dueText, { color: look.text }]}>
        {state === 'overdue' ? 'Overdue' : shortDate(dueAt)}
      </Text>
    </View>
  );
}

/** Overlapping avatars (first three, then "+n"). */
export function AvatarStack({ people, size = 26 }: { people: CardPerson[]; size?: number }) {
  const shown = people.slice(0, 3);
  const extra = people.length - shown.length;
  return (
    <View style={styles.stack}>
      {shown.map((p, i) => (
        <View key={p.id} style={[styles.stackItem, i > 0 && { marginLeft: -size * 0.25 }]}>
          <MemberAvatar name={p.name} seed={p.id} size={size} />
        </View>
      ))}
      {extra > 0 ? <Text style={styles.extra}>+{extra}</Text> : null}
    </View>
  );
}

/** One card on the board (13 · Board): labels, title, due date, checklist count, avatars. */
export function CardFace({
  card,
  onPress,
  onLongPress,
  active,
}: {
  card: CardSummary;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Being dragged. */
  active?: boolean;
}) {
  const { checklist } = card;
  const hasMeta = !!card.dueAt || checklist.total > 0;
  const a11y = [
    card.title,
    card.labels.length ? `labels ${card.labels.map((l) => l.name).join(', ')}` : null,
    card.dueAt
      ? `due ${shortDate(card.dueAt)}${dueState(card.dueAt) === 'overdue' ? ', overdue' : ''}`
      : null,
    checklist.total ? `checklist ${checklist.done} of ${checklist.total}` : null,
    card.assignees.length ? `assigned to ${card.assignees.map((p) => p.name).join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={onLongPress ? 'Long-press to drag up or down' : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => [
        styles.card,
        active && styles.cardActive,
        pressed && !active && styles.pressed,
      ]}>
      {card.labels.length ? (
        <View style={styles.labels}>
          {card.labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </View>
      ) : null}
      <AppText style={styles.title}>{card.title}</AppText>
      <View style={styles.footer}>
        <View style={styles.meta}>
          {card.dueAt ? <DueChip dueAt={card.dueAt} /> : null}
          {checklist.total > 0 ? (
            <View style={styles.metaItem}>
              <Feather
                name="check-square"
                size={13}
                color={checklist.done === checklist.total ? colors.success : colors.muted}
              />
              <Text
                style={[
                  styles.metaText,
                  checklist.done === checklist.total && { color: colors.success },
                ]}>
                {checklist.done}/{checklist.total}
              </Text>
            </View>
          ) : null}
          {!hasMeta ? <Text style={styles.noDue}>No due date</Text> : null}
        </View>
        {card.assignees.length ? <AvatarStack people={card.assignees} /> : null}
      </View>
    </Pressable>
  );
}

/** Dark pill at the bottom of the board for short messages (errors after a failed move). */
export function Toast({
  message,
  tone = 'error',
  onHide,
}: {
  message: string | null;
  tone?: 'error' | 'info';
  onHide: () => void;
}) {
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    const timer = setTimeout(onHide, 4000);
    return () => clearTimeout(timer);
  }, [message, onHide, opacity]);

  if (!message) return null;
  return (
    <Animated.View style={[styles.toastWrap, { opacity }]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        onPress={onHide}
        style={styles.toast}>
        <View
          style={[styles.toastDot, { backgroundColor: tone === 'error' ? '#F06A7A' : '#3DD68C' }]}
        />
        <Text style={styles.toastText}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  label: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, maxWidth: 160 },
  labelLarge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  labelText: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  labelTextLarge: { fontSize: 14, lineHeight: 18 },
  due: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dueText: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  stack: { flexDirection: 'row', alignItems: 'center' },
  stackItem: { borderRadius: 999, borderWidth: 1.5, borderColor: colors.surface },
  extra: { marginLeft: 4, fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardActive: {
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pressed: { backgroundColor: '#FAFBFC' },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  title: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 26,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  noDue: { fontSize: 13, color: colors.muted },
  toastWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#1C1E24',
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  toastDot: { width: 8, height: 8, borderRadius: 4 },
  toastText: {
    color: colors.surface,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 19,
    flexShrink: 1,
  },
});
