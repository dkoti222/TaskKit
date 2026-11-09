import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { colors, spacing } from '@/theme';

type Action = { title: string; onPress: () => void };

/** 31 · Access removed. Shown when a board or workspace returns 404 (no access). */
export function AccessRemoved({
  title,
  message,
  primary,
  secondary,
}: {
  title: string;
  message: string;
  primary: Action;
  secondary?: Action;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <View style={styles.lockTile}>
          <Feather name="lock" size={24} color={colors.muted} />
        </View>
        <AppText variant="heading" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        <AppText variant="secondary" style={styles.message}>
          {message}
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button title={primary.title} onPress={primary.onPress} />
        {secondary ? (
          <Button title={secondary.title} variant="secondary" onPress={secondary.onPress} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  lockTile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#EEF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { textAlign: 'center', fontSize: 20, lineHeight: 26 },
  message: { textAlign: 'center', fontSize: 14, lineHeight: 21 },
  actions: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm },
});
