import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/errors';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useMe } from '@/hooks/use-me';
import { firstName } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';

// Simple logged-in home: shows GET /me. Replaced by 06 Your workspaces later.
export default function HomeScreen() {
  const me = useMe();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={me.isRefetching}
            onRefresh={() => {
              void me.refetch();
            }}
            tintColor={colors.primary}
          />
        }>
        {me.isPending ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="secondary">Loading your profile…</AppText>
          </View>
        ) : me.isError ? (
          <View style={styles.card}>
            <AppText variant="label">Couldn{'’'}t load your profile</AppText>
            <AppText variant="secondary" style={{ color: colors.danger }}>
              {getErrorMessage(me.error)}
            </AppText>
            <Button title="Try again" variant="secondary" onPress={() => me.refetch()} />
          </View>
        ) : (
          <>
            <View>
              <AppText variant="secondary">Welcome, {firstName(me.data.name)}</AppText>
              <AppText variant="title">Your workspaces</AppText>
            </View>
            <View style={[styles.card, styles.empty]}>
              <AppText variant="label">Workspaces are coming next</AppText>
              <AppText variant="secondary" style={styles.centerText}>
                You{'’'}re logged in as {me.data.email}. Your workspaces will show here once the
                workspaces API is ready.
              </AppText>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.lg },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  centerText: { textAlign: 'center' },
});
