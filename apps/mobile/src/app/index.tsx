import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { logOut } from '@/api/auth';
import { getErrorMessage } from '@/api/errors';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useMe } from '@/hooks/use-me';
import { colors, fonts, radius, spacing } from '@/theme';

// Simple logged-in home: shows GET /me. Replaced by 06 Your workspaces later.
export default function HomeScreen() {
  const me = useMe();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogOut = async () => {
    setLoggingOut(true);
    await logOut(); // the route guard then shows Welcome
  };

  return (
    <SafeAreaView style={styles.safe}>
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
          <View style={[styles.card, styles.errorCard]}>
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
              <AppText variant="title">You{'’'}re logged in</AppText>
            </View>

            <View style={styles.card}>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <AppText style={styles.avatarText}>{initials(me.data.name)}</AppText>
                </View>
                <View style={styles.flex}>
                  <AppText variant="label" style={{ fontSize: 16 }}>
                    {me.data.name}
                  </AppText>
                  <AppText variant="secondary">{me.data.email}</AppText>
                </View>
              </View>
              <Row label="Time zone" value={me.data.timezone ?? 'Not set'} />
              <Row
                label="Email verified"
                value={
                  me.data.emailVerifiedAt
                    ? new Date(me.data.emailVerifiedAt).toLocaleDateString()
                    : 'Not yet'
                }
              />
            </View>

            <AppText variant="small" style={styles.hint}>
              Pull down to reload. Workspaces arrive in the next milestone.
            </AppText>
          </>
        )}

        <Button
          title="Log out"
          variant="secondary"
          loading={loggingOut}
          onPress={onLogOut}
          style={styles.logout}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="secondary">{label}</AppText>
      <AppText variant="body">{value}</AppText>
    </View>
  );
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.lg },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    gap: spacing.md,
  },
  errorCard: { gap: spacing.sm },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.semibold, color: colors.primary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.md,
  },
  hint: { textAlign: 'center' },
  logout: { marginTop: 'auto' },
});
