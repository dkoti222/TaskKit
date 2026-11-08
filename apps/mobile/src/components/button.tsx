import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, fonts, radius, sizes } from '@/theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const inactive = disabled || loading;
  const filled = variant !== 'secondary';
  const background = variant === 'danger' ? colors.danger : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        filled
          ? { backgroundColor: pressed && variant === 'primary' ? colors.primaryPressed : background }
          : [styles.secondary, pressed && { backgroundColor: colors.background }],
        filled && pressed && variant === 'danger' && { opacity: 0.9 },
        inactive && { opacity: 0.6 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={filled ? colors.surface : colors.ink} />
      ) : (
        <Text style={[styles.text, { color: filled ? colors.surface : colors.ink }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: sizes.primaryButton,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { fontFamily: fonts.semibold, fontSize: 15 },
});
