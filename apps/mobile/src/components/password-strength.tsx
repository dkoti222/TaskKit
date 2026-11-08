import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { passwordStrength } from '@/lib/validation';
import { colors, spacing } from '@/theme';

const LABELS = ['', 'Too weak', 'Good password', 'Strong password'] as const;

/** Three-bar strength meter. The label is optional (Set new password shows it). */
export function PasswordStrength({ password, showLabel }: { password: string; showLabel?: boolean }) {
  const level = passwordStrength(password);
  const fill = level === 1 ? colors.danger : colors.success;

  return (
    <View style={styles.wrapper}>
      <View
        style={styles.bars}
        accessible
        accessibilityLabel={level ? `Password strength: ${LABELS[level]}` : 'Password strength'}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.bar, { backgroundColor: i <= level ? fill : colors.divider }]} />
        ))}
      </View>
      {showLabel && level > 0 ? (
        <AppText variant="small" style={{ color: fill }}>
          {LABELS[level]}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs, marginTop: -spacing.sm },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
});
