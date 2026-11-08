import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, fonts, radius, sizes } from '@/theme';

type Props = TextInputProps & {
  label: string;
  /** Shown at the right of the label row, e.g. a "Forgot password?" link. */
  labelAccessory?: ReactNode;
  invalid?: boolean;
};

export const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  { label, labelAccessory, invalid, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>
        {labelAccessory}
      </View>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.placeholder}
        style={[
          styles.input,
          focused && { borderColor: colors.primary },
          invalid && { borderColor: colors.danger },
          style,
        ]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 20,
  },
  label: { fontSize: 13 },
  input: {
    height: sizes.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});
