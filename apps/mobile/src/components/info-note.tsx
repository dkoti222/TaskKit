import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, spacing } from '@/theme';

/** Grey box with an icon and a short explanation. */
export function InfoNote({
  icon,
  children,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  children: string;
}) {
  return (
    <View style={styles.box}>
      <Feather name={icon} size={17} color={colors.muted} style={styles.icon} />
      <AppText variant="secondary" style={styles.text}>
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
