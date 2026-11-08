import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, radius, spacing } from '@/theme';

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
      <Feather name={icon} size={16} color={colors.muted} style={styles.icon} />
      <AppText variant="small" style={styles.text}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.background,
  },
  icon: { marginTop: 1 },
  text: { flex: 1 },
});
