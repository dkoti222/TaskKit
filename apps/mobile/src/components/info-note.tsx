import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, spacing } from '@/theme';

/** Grey (or soft blue) box with an icon and a short explanation. */
export function InfoNote({
  icon,
  tone = 'neutral',
  children,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  tone?: 'neutral' | 'primary';
  children: string;
}) {
  const fg = tone === 'primary' ? colors.primary : colors.muted;
  return (
    <View style={[styles.box, tone === 'primary' && { backgroundColor: colors.primarySoft }]}>
      <Feather name={icon} size={17} color={fg} style={styles.icon} />
      <AppText variant="secondary" style={[styles.text, { color: fg }]}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  icon: { marginTop: 2 },
  text: { flex: 1, fontSize: 14, lineHeight: 21 },
});
