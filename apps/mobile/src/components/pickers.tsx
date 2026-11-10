import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import type { Label } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { LabelChip } from '@/components/card-ui';
import { FormMessage } from '@/components/misc';
import { MemberAvatar } from '@/components/workspace-ui';
import type { BoardPerson } from '@/hooks/use-board-people';
import { useCreateLabel } from '@/hooks/use-cards';
import { firstName } from '@/lib/format';
import { colors, fonts, radius, spacing } from '@/theme';

/** Label colours offered when creating a label (same family as board colours). */
export const LABEL_COLORS = ['#2F5BEA', '#12936A', '#D9435A', '#E8833A', '#8B5CF6', '#4B5160'];

/** "Assign to" chips: avatar + first name; selected ones get a blue outline. */
export function PeoplePicker({
  people,
  selected,
  onToggle,
  disabled,
}: {
  people: BoardPerson[];
  selected: Set<string>;
  onToggle: (person: BoardPerson) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      {people.map((p) => {
        const on = selected.has(p.id);
        return (
          <Pressable
            key={p.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled: !!disabled }}
            accessibilityLabel={`Assign ${p.name}`}
            disabled={disabled}
            onPress={() => onToggle(p)}
            style={({ pressed }) => [
              styles.person,
              on && styles.personOn,
              pressed && { opacity: 0.6 },
              disabled && { opacity: 0.5 },
            ]}>
            <MemberAvatar name={p.name} seed={p.id} size={26} />
            <Text style={[styles.personName, on && { fontFamily: fonts.semibold }]}>
              {firstName(p.name)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Label chips to tick on and off. Board Owners and Admins also get a dashed "New label" chip
 * that opens a small form (POST /boards/:id/labels); the new label is ticked straight away.
 */
export function LabelPicker({
  boardId,
  labels,
  selected,
  onToggle,
  canCreate,
  disabled,
}: {
  boardId: string;
  labels: Label[];
  selected: Set<string>;
  onToggle: (label: Label) => void;
  canCreate: boolean;
  disabled?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <View style={styles.labelBlock}>
      <View style={styles.wrap}>
        {labels.map((label) => (
          <LabelChip
            key={label.id}
            label={label}
            size="large"
            selected={selected.has(label.id)}
            onPress={disabled ? undefined : () => onToggle(label)}
          />
        ))}
        {canCreate && !creating && !disabled ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setCreating(true)}
            style={({ pressed }) => [styles.newLabel, pressed && { opacity: 0.6 }]}>
            <Text style={styles.newLabelText}>New label</Text>
          </Pressable>
        ) : null}
      </View>
      {labels.length === 0 && !canCreate ? (
        <AppText variant="small">
          No labels on this board yet. Owners and Admins can add them.
        </AppText>
      ) : null}
      {creating ? (
        <NewLabelForm
          boardId={boardId}
          onDone={(label) => {
            setCreating(false);
            if (label) onToggle(label);
          }}
        />
      ) : null}
    </View>
  );
}

function NewLabelForm({
  boardId,
  onDone,
}: {
  boardId: string;
  onDone: (label: Label | null) => void;
}) {
  const create = useCreateLabel(boardId);
  const [name, setName] = useState('');
  const [color, setColor] = useState(LABEL_COLORS[0]);
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || create.isPending) return;
    create.mutate({ name: trimmed, color }, { onSuccess: (label) => onDone(label) });
  };
  return (
    <View style={styles.form}>
      <View style={styles.formRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Label name"
          placeholderTextColor={colors.placeholder}
          maxLength={30}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          accessibilityLabel="New label name"
          style={styles.input}
        />
        <LabelChip label={{ name: name.trim() || 'Preview', color }} size="large" />
      </View>
      <View accessibilityRole="radiogroup" style={styles.swatches}>
        {LABEL_COLORS.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityState={{ checked: c === color }}
            accessibilityLabel={`Colour ${c}`}
            onPress={() => setColor(c)}
            style={[styles.swatch, { backgroundColor: c }, c === color && styles.swatchOn]}>
            {c === color ? <Feather name="check" size={14} color={colors.surface} /> : null}
          </Pressable>
        ))}
      </View>
      <FormMessage message={create.isError ? getErrorMessage(create.error) : null} />
      <View style={styles.formActions}>
        <Button
          title="Create label"
          onPress={submit}
          loading={create.isPending}
          disabled={!name.trim()}
          style={styles.formButton}
        />
        <Button
          title="Cancel"
          variant="secondary"
          onPress={() => onDone(null)}
          disabled={create.isPending}
          style={styles.formButton}
        />
      </View>
    </View>
  );
}

/** Small spinner/error/retry row for a picker whose data is still loading. */
export function PickerStatus({
  pending,
  error,
  onRetry,
}: {
  pending: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (pending) return <ActivityIndicator color={colors.primary} style={styles.status} />;
  if (!error) return null;
  return (
    <View style={styles.statusRow}>
      <AppText variant="small" style={{ color: colors.danger, flex: 1 }}>
        {getErrorMessage(error)}
      </AppText>
      <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={10}>
        <Text style={styles.retry}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 4,
    paddingRight: 14,
    height: 38,
    backgroundColor: colors.surface,
  },
  personOn: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: colors.primarySoft,
  },
  personName: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  labelBlock: { gap: spacing.md },
  newLabel: {
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  newLabelText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: colors.muted },
  form: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.background,
  },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
  },
  swatches: { flexDirection: 'row', gap: spacing.sm },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchOn: { borderWidth: 2, borderColor: colors.ink },
  formActions: { flexDirection: 'row', gap: spacing.sm },
  formButton: { flex: 1, height: 44 },
  status: { alignSelf: 'flex-start' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  retry: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
});
