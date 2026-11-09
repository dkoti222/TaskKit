import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, fonts } from '@/theme';

type FeatherName = ComponentProps<typeof Feather>['name'];

/** 44×44 icon-only button (back, close). */
export function IconButton({
  icon,
  label,
  onPress,
  color = colors.ink,
}: {
  icon: FeatherName;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.5 }]}>
      <Feather name={icon} size={22} color={color} />
    </Pressable>
  );
}

/** Inline blue text link. hitSlop keeps the touch target at least 44px tall. */
export function TextLink({
  title,
  onPress,
  inline,
}: {
  title: string;
  onPress: () => void;
  /** Smaller, medium-weight link that sits in a label row. */
  inline?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
      {({ pressed }) => (
        <Text style={[styles.link, inline && styles.linkInline, pressed && { opacity: 0.6 }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/** "Question? Action" line used at the bottom of auth screens. */
export function FooterPrompt({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.footerRow}>
      <AppText variant="secondary">{prompt} </AppText>
      <TextLink title={action} onPress={onPress} />
    </View>
  );
}

/** Soft blue square holding an icon (Verify email, Reset password). */
export function IconTile({ icon }: { icon: FeatherName }) {
  return (
    <View style={styles.tile}>
      <Feather name={icon} size={24} color={colors.primary} />
    </View>
  );
}

const TONE_COLORS = { error: colors.danger, success: colors.success, info: colors.muted };

/** Message shown under a form. Errors are plain danger-coloured text. */
export function FormMessage({
  tone = 'error',
  message,
}: {
  tone?: 'error' | 'success' | 'info';
  message?: string | null;
}) {
  if (!message) return null;
  return (
    <AppText
      accessibilityLiveRegion="polite"
      variant="secondary"
      style={{ color: TONE_COLORS[tone] }}>
      {message}
    </AppText>
  );
}

/** TaskKit mark: blue rounded square with three board columns. */
export function Logo({ size = 32 }: { size?: number }) {
  const bar = { width: size * 0.09, borderRadius: size * 0.05, backgroundColor: colors.surface };
  return (
    <View style={styles.logoRow}>
      <View
        style={[
          styles.logoMark,
          {
            width: size,
            height: size,
            borderRadius: size * 0.25,
            gap: size * 0.1,
            paddingTop: size * 0.29,
          },
        ]}>
        <View style={[bar, { height: size * 0.42 }]} />
        <View style={[bar, { height: size * 0.3 }]} />
        <View style={[bar, { height: size * 0.42 }]} />
      </View>
      <Text style={[styles.logoText, { fontSize: size * 0.52 }]}>TaskKit</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  link: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
  linkInline: { fontFamily: fonts.medium, fontSize: 14 },
  footerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logoText: { fontFamily: fonts.bold, color: colors.ink },
});
