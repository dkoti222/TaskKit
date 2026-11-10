import Feather from '@expo/vector-icons/Feather';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { dateTime, dueState } from '@/lib/format';
import { colors, fonts, radius, sizes, spacing } from '@/theme';

/** Tomorrow at 6 PM: a sensible starting point when there's no due date yet. */
function defaultDue() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

/** Web has no native picker, so it gets a few presets (only used for local testing). */
function presets() {
  const at = (days: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  return [
    { label: 'Today, 6 PM', date: at(0, 18) },
    { label: 'Tomorrow, 9 AM', date: at(1, 9) },
    { label: 'In a week', date: at(7, 9) },
  ];
}

/**
 * "Pick a date and time" field. Android opens the date dialog, then the time dialog.
 * iOS shows an inline date and time picker in a sheet.
 */
export function DueDateField({
  value,
  onChange,
  disabled,
  variant = 'field',
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
  /** "field" for forms (16), "chip" for the card detail row (15). */
  variant?: 'field' | 'chip';
}) {
  const [step, setStep] = useState<'date' | 'time' | 'sheet' | null>(null);
  const [draft, setDraft] = useState<Date>(() => (value ? new Date(value) : defaultDue()));

  const open = () => {
    if (disabled) return;
    setDraft(value ? new Date(value) : defaultDue());
    setStep(Platform.OS === 'android' ? 'date' : 'sheet');
  };

  const state = value ? dueState(value) : null;
  const tone =
    state === 'overdue'
      ? { bg: colors.dangerSoft, text: colors.danger }
      : state === 'soon'
        ? { bg: '#FDEEE2', text: '#B5561A' }
        : { bg: '#EEF0F3', text: colors.ink };

  return (
    <>
      {variant === 'chip' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value ? `Due ${dateTime(value)}. Change due date` : 'Add a due date'}
          disabled={disabled}
          onPress={open}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: value ? tone.bg : 'transparent' },
            !value && styles.chipEmpty,
            pressed && { opacity: 0.6 },
          ]}>
          <Feather name="calendar" size={14} color={value ? tone.text : colors.muted} />
          <Text style={[styles.chipText, { color: value ? tone.text : colors.muted }]}>
            {value
              ? `${dateTime(value)}${state === 'overdue' ? ' · overdue' : state === 'soon' ? ' · due soon' : ''}`
              : disabled
                ? 'None'
                : 'Add due date'}
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.field, disabled && { opacity: 0.6 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              value ? `Due date ${dateTime(value)}. Change` : 'Pick a due date and time'
            }
            disabled={disabled}
            onPress={open}
            style={styles.fieldPress}>
            <Feather name="calendar" size={17} color={colors.muted} />
            <Text style={[styles.fieldText, !value && { color: colors.placeholder }]}>
              {value ? dateTime(value) : 'Pick a date and time'}
            </Text>
          </Pressable>
          {value && !disabled ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove due date"
              onPress={() => onChange(null)}
              hitSlop={8}
              style={styles.clear}>
              <Feather name="x" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      )}

      {/* Android: date dialog, then time dialog. Each mounts open and unmounts when done. */}
      {step === 'date' ? (
        <DateTimePicker
          mode="date"
          value={draft}
          accentColor={colors.primary}
          onValueChange={(_e, date) => {
            const next = new Date(draft);
            next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
            setDraft(next);
            setStep('time');
          }}
          onDismiss={() => setStep(null)}
        />
      ) : null}
      {step === 'time' ? (
        <DateTimePicker
          mode="time"
          value={draft}
          accentColor={colors.primary}
          onValueChange={(_e, date) => {
            const next = new Date(draft);
            next.setHours(date.getHours(), date.getMinutes(), 0, 0);
            setStep(null);
            onChange(next.toISOString());
          }}
          onDismiss={() => setStep(null)}
        />
      ) : null}

      <Sheet visible={step === 'sheet'} onClose={() => setStep(null)} title="Due date">
        <View style={styles.sheetBody}>
          {Platform.OS === 'web' ? (
            <View style={styles.presets}>
              {presets().map((p) => (
                <Button
                  key={p.label}
                  title={p.label}
                  variant="secondary"
                  onPress={() => {
                    setStep(null);
                    onChange(p.date.toISOString());
                  }}
                />
              ))}
            </View>
          ) : (
            <DateTimePicker
              mode="datetime"
              display="inline"
              value={draft}
              accentColor={colors.primary}
              onValueChange={(_e, date) => setDraft(date)}
            />
          )}
          {Platform.OS !== 'web' ? (
            <Button
              title="Save due date"
              onPress={() => {
                setStep(null);
                onChange(draft.toISOString());
              }}
            />
          ) : null}
          {value ? (
            <Button
              title="Remove due date"
              variant="text"
              onPress={() => {
                setStep(null);
                onChange(null);
              }}
            />
          ) : null}
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: sizes.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  fieldPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 14,
    height: '100%',
  },
  fieldText: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  clear: { width: 44, height: '100%', alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    minHeight: 32,
  },
  chipEmpty: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  chipText: { fontFamily: fonts.medium, fontSize: 14 },
  sheetBody: { padding: spacing.lg, gap: spacing.md },
  presets: { gap: spacing.sm },
});
