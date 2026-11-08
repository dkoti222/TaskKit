import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, fonts, radius, sizes } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'text';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Feather>['name'];
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

const LOOK: Record<Variant, { bg: string; pressedBg: string; border?: string; text: string }> = {
  primary: { bg: colors.primary, pressedBg: colors.primaryPressed, text: colors.surface },
  danger: { bg: colors.danger, pressedBg: '#9A1D2D', text: colors.surface },
  secondary: { bg: colors.surface, pressedBg: colors.background, border: colors.border, text: colors.ink },
  dangerOutline: { bg: colors.surface, pressedBg: colors.dangerSoft, border: '#EBB6BD', text: colors.danger },
  text: { bg: 'transparent', pressedBg: colors.background, text: colors.ink },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
}: Props) {
  const inactive = disabled || loading;
  const look = LOOK[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? look.pressedBg : look.bg },
        look.border ? { borderWidth: 1, borderColor: look.border } : null,
        variant === 'text' && styles.textOnly,
        inactive && { opacity: 0.6 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={look.text} />
      ) : (
        <View style={styles.row}>
          {icon ? <Feather name={icon} size={18} color={look.text} /> : null}
          <Text style={[styles.text, { color: look.text }]}>{title}</Text>
        </View>
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
  textOnly: { height: sizes.touchTarget + 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontFamily: fonts.semibold, fontSize: 16 },
});
