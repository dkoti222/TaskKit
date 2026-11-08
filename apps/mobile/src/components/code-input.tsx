import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { colors, fonts, radius } from '@/theme';

type Props = {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  invalid?: boolean;
  autoFocus?: boolean;
};

/**
 * Row of digit boxes backed by one hidden TextInput, so paste and
 * SMS/email one-time-code autofill work naturally.
 */
export function CodeInput({ value, onChange, length = 6, invalid, autoFocus }: Props) {
  const inputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessible={false}>
      <View style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const digit = value[i] ?? '';
          const active = focused && i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              style={[
                styles.box,
                digit ? styles.boxFilled : null,
                active ? styles.boxActive : null,
                invalid ? styles.boxInvalid : null,
              ]}>
              <Text style={styles.digit}>{digit}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        accessibilityLabel={`${length}-digit verification code`}
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  box: {
    flex: 1,
    height: 56,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  boxFilled: { borderColor: colors.primary },
  boxActive: { borderColor: colors.primary, borderWidth: 1.5 },
  boxInvalid: { borderColor: colors.danger },
  digit: { fontFamily: fonts.semibold, fontSize: 22, color: colors.ink },
  // Covers the boxes so taps land on the real input; invisible but still focusable.
  hiddenInput: { ...StyleSheet.absoluteFill, opacity: 0.01, color: 'transparent' },
});
