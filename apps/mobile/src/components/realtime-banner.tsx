import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { retryNow, useRealtime } from '@/realtime/socket';
import { colors, fonts, radius, spacing } from '@/theme';

/**
 * 30 · Offline: a dark bar under the board header.
 * - No network: "You're offline. Showing saved data." with Retry.
 * - Network, but the live connection dropped: "Reconnecting…".
 */
export function RealtimeBanner() {
  const online = useRealtime((s) => s.online);
  const showReconnecting = useRealtime((s) => s.showReconnecting);

  if (!online) {
    return (
      <View style={styles.bar} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Feather name="wifi-off" size={16} color={colors.surface} />
        <Text style={styles.text}>You{'’'}re offline. Showing saved data.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry"
          onPress={() => void retryNow()}
          hitSlop={8}
          style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (showReconnecting) {
    return (
      <View style={styles.bar} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={colors.surface} />
        <Text style={styles.text}>Reconnecting{'…'} Changes from others will appear soon.</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.ink,
  },
  text: {
    flex: 1,
    color: colors.surface,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  retry: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  retryText: {
    color: colors.surface,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
});
