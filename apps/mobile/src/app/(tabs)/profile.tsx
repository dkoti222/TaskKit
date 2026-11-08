import Feather from '@expo/vector-icons/Feather';
import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { forgotPassword, logOut } from '@/api/auth';
import { getErrorMessage } from '@/api/errors';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useMe } from '@/hooks/use-me';
import { initials } from '@/lib/format';
import { colors, fonts, radius, spacing } from '@/theme';

// 22 · Profile and settings
// Not built yet (no API): notification preferences, active devices, log out of other devices.
export default function ProfileScreen() {
  const me = useMe();
  const [loggingOut, setLoggingOut] = useState(false);

  // "Change password" uses the existing reset flow: we email a link that opens Set new password.
  const changePassword = useMutation({ mutationFn: forgotPassword });

  const onLogOut = async () => {
    setLoggingOut(true);
    await logOut(); // the route guard then shows Welcome
  };

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
        <AppText variant="title">Profile</AppText>

        {/* Profile card */}
        <View style={[styles.card, styles.profileCard]}>
          {me.isPending ? (
            <ActivityIndicator color={colors.primary} style={styles.flex} />
          ) : me.isError ? (
            <View style={styles.flex}>
              <AppText variant="secondary" style={{ color: colors.danger }}>
                {getErrorMessage(me.error)}
              </AppText>
              <Pressable onPress={() => me.refetch()} hitSlop={12}>
                <AppText style={styles.retry}>Try again</AppText>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(me.data.name)}</Text>
              </View>
              <View style={styles.flex}>
                <AppText style={styles.name} numberOfLines={1}>
                  {me.data.name}
                </AppText>
                <AppText variant="secondary" style={styles.email} numberOfLines={1}>
                  {me.data.email}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                onPress={() => router.push('/edit-profile')}
                style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Account */}
        <AppText style={styles.sectionLabel}>Account</AppText>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            disabled={!me.data || changePassword.isPending}
            onPress={() => me.data && changePassword.mutate({ email: me.data.email })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <AppText style={styles.rowText}>Change password</AppText>
            {changePassword.isPending ? (
              <ActivityIndicator color={colors.muted} />
            ) : (
              <Feather name="chevron-right" size={20} color={colors.muted} />
            )}
          </Pressable>
          {changePassword.isSuccess || changePassword.isError ? (
            <AppText
              variant="small"
              style={[styles.rowNote, changePassword.isError && { color: colors.danger }]}>
              {changePassword.isError
                ? getErrorMessage(changePassword.error)
                : `We emailed a link to ${me.data?.email}. Open it on this phone to set a new password.`}
            </AppText>
          ) : null}
        </View>

        <Button
          title="Log out"
          icon="log-out"
          variant="dangerOutline"
          loading={loggingOut}
          onPress={onLogOut}
          style={styles.logout}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/delete-account')}
          style={({ pressed }) => [styles.deleteLink, pressed && { opacity: 0.6 }]}>
          <Text style={styles.deleteText}>Delete account</Text>
        </Pressable>

        <AppText variant="small" style={styles.version}>
          TaskKit {Constants.expoConfig?.version ?? ''}
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: spacing.lg, gap: spacing.lg },
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: spacing.lg,
    minHeight: 92,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 20, color: '#2A46C4' },
  name: { fontFamily: fonts.semibold, fontSize: 17 },
  email: { fontSize: 14 },
  editButton: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  editText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  retry: { fontFamily: fonts.semibold, color: colors.primary, marginTop: spacing.xs },
  sectionLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, marginBottom: -6 },
  row: {
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: { fontSize: 16 },
  rowNote: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, marginTop: -4 },
  pressed: { backgroundColor: colors.background },
  logout: { marginTop: spacing.sm },
  deleteLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  deleteText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.danger },
  version: { textAlign: 'center', marginTop: -spacing.sm },
});
