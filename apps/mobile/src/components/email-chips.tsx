import Feather from '@expo/vector-icons/Feather';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { isEmail } from '@/lib/validation';
import { colors, fonts, radius } from '@/theme';

type Props = {
  emails: string[];
  onChange: (emails: string[]) => void;
  /** Text not yet turned into a chip. Kept by the parent so it can be included on submit. */
  draft: string;
  onDraftChange: (draft: string) => void;
  placeholder?: string;
  invalid?: boolean;
  accessibilityLabel: string;
};

/** Normalises an email the same way the API does (trim + lowercase). */
export const normalizeEmail = (value: string) => value.trim().toLowerCase();

/**
 * Email field that turns each address into a removable chip
 * when the user types a space, comma or presses return.
 */
export function EmailChips({
  emails,
  onChange,
  draft,
  onDraftChange,
  placeholder = 'name@company.com',
  invalid,
  accessibilityLabel,
}: Props) {
  const inputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);

  const commit = (raw: string) => {
    const parts = raw
      .split(/[\s,;]+/)
      .map(normalizeEmail)
      .filter(Boolean);
    const valid = parts.filter((p) => isEmail(p) && !emails.includes(p));
    const leftover = parts.filter((p) => !isEmail(p)).join(' ');
    if (valid.length) onChange([...emails, ...new Set(valid)]);
    onDraftChange(leftover);
  };

  const onChangeText = (text: string) => {
    // A separator at the end (or a pasted list) means "make chips from what's there".
    if (/[\s,;]/.test(text)) commit(text);
    else onDraftChange(text);
  };

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessible={false}
      style={[
        styles.box,
        focused && { borderColor: colors.primary },
        invalid && { borderColor: colors.danger },
      ]}>
      {emails.map((email) => (
        <View key={email} style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>
            {email}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${email}`}
            hitSlop={10}
            onPress={() => onChange(emails.filter((e) => e !== email))}>
            <Feather name="x" size={14} color={colors.primary} />
          </Pressable>
        </View>
      ))}
      <TextInput
        ref={inputRef}
        value={draft}
        onChangeText={onChangeText}
        onSubmitEditing={() => commit(draft)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (isEmail(draft)) commit(draft);
        }}
        submitBehavior="submit"
        placeholder={emails.length ? 'Add email' : placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="done"
        accessibilityLabel={accessibilityLabel}
        onKeyPress={({ nativeEvent }) => {
          // Backspace on an empty field removes the last chip.
          if (nativeEvent.key === 'Backspace' && !draft && emails.length) {
            onChange(emails.slice(0, -1));
          }
        }}
        style={styles.input}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    backgroundColor: colors.primarySoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: '#2A46C4', flexShrink: 1 },
  input: {
    flexGrow: 1,
    minWidth: 140,
    height: 34,
    paddingHorizontal: 6,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});
