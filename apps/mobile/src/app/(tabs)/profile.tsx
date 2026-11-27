import Feather from '@expo/vector-icons/Feather';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { listSessions, logoutOtherDevices } from '@/api/sessions';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Sheet } from '@/components/sheet';
import { useMe } from '@/hooks/use-me';
import { useNotificationSettings, useUpdateNotificationSettings } from '@/hooks/use-notifications';
import { pushUnavailableReason } from '@/notifications/push';
import { initials, timeAgo } from '@/lib/format';
import { colors, fonts, radius, spacing } from '@/theme';

// 22 · Profile and settings
// Active devices come from GET /me/sessions (one per login; this phone is marked).
export default function ProfileScreen() {
  const me = useMe();
  const [loggingOut, setLoggingOut] = useState(false);
  const settings = useNotificationSettings();
  const updateSettings = useUpdateNotificationSettings();
  const pushNote = pushUnavailableReason();

  // Active devices (one per login session) and "Log out of other devices".
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ['me', 'sessions'], queryFn: listSessions });
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [confirmOthers, setConfirmOthers] = useState(false);
  const logoutOthers = useMutation({
    mutationFn: logoutOtherDevices,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me', 'sessions'] }),
  });
  const deviceCount = sessions.data?.length ?? 0;
  const others = (sessions.data ?? []).filter((s) => !s.current).length;

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

        {/* Notifications (Step 11) */}
        <AppText style={styles.sectionLabel}>Notifications</AppText>
        <View style={styles.card}>
          {settings.isPending ? (
            <ActivityIndicator color={colors.primary} style={styles.settingsLoading} />
          ) : settings.isError ? (
            <Pressable onPress={() => settings.refetch()} style={styles.row}>
              <AppText variant="secondary">{getErrorMessage(settings.error)} Tap to retry.</AppText>
            </Pressable>
          ) : (
            (
              [
                ['push', 'Push notifications'],
                ['mentionEmail', 'Email me when mentioned'],
                ['dueReminders', 'Due date reminders'],
              ] as const
            ).map(([key, label], index) => {
              const on = settings.data[key];
              return (
                <Pressable
                  key={key}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => updateSettings.mutate({ [key]: !on })}
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && styles.rowDivider,
                    pressed && styles.pressed,
                  ]}>
                  <AppText style={styles.rowText}>{label}</AppText>
                  <View style={[styles.box, on && styles.boxOn]}>
                    {on ? <Feather name="check" size={14} color={colors.surface} /> : null}
                  </View>
                </Pressable>
              );
            })
          )}
          {settings.data?.push && pushNote ? (
            <AppText variant="small" style={styles.rowNote}>
              {pushNote} You’ll still see everything in Alerts.
            </AppText>
          ) : null}
          {updateSettings.isError ? (
            <AppText variant="small" style={[styles.rowNote, { color: colors.danger }]}>
              {getErrorMessage(updateSettings.error)}
            </AppText>
          ) : null}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Active devices, ${deviceCount} signed in`}
            onPress={() => setDevicesOpen(true)}
            style={({ pressed }) => [styles.row, styles.rowDivider, pressed && styles.pressed]}>
            <AppText style={styles.rowText}>Active devices</AppText>
            {sessions.isPending ? (
              <ActivityIndicator color={colors.muted} />
            ) : (
              <AppText variant="small">
                {sessions.isError ? 'Tap to retry' : `${deviceCount} signed in`}
              </AppText>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={others === 0 || logoutOthers.isPending}
            onPress={() => {
              logoutOthers.reset();
              setConfirmOthers(true);
            }}
            style={({ pressed }) => [styles.row, styles.rowDivider, pressed && styles.pressed]}>
            <AppText style={[styles.rowText, styles.link, others === 0 && styles.linkOff]}>
              Log out of other devices
            </AppText>
          </Pressable>
          {logoutOthers.isSuccess ? (
            <AppText variant="small" style={styles.rowNote}>
              {logoutOthers.data.message}. They’ll be signed out within 15 minutes.
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

        <Sheet
          visible={devicesOpen}
          onClose={() => setDevicesOpen(false)}
          title="Active devices"
          subtitle="Where you're signed in">
          <View style={styles.devices}>
            {sessions.isError ? (
              <Button title="Try again" variant="secondary" onPress={() => sessions.refetch()} />
            ) : (
              (sessions.data ?? []).map((s) => (
                <View key={s.id} style={styles.device}>
                  <Feather
                    name={/web/i.test(s.deviceName ?? '') ? 'monitor' : 'smartphone'}
                    size={20}
                    color={colors.muted}
                  />
                  <View style={styles.flex}>
                    <AppText style={styles.deviceName}>
                      {s.deviceName ?? 'Unknown device'}
                      {s.current ? (
                        <AppText style={styles.thisDevice}> · This device</AppText>
                      ) : null}
                    </AppText>
                    <AppText variant="small">
                      Last active: {timeAgo(s.lastActiveAt)} · Signed in: {timeAgo(s.signedInAt)}
                    </AppText>
                  </View>
                </View>
              ))
            )}
          </View>
        </Sheet>

        <ConfirmDialog
          visible={confirmOthers}
          icon="log-out"
          title="Log out of other devices?"
          message={`${others} other ${others === 1 ? 'device' : 'devices'} will be signed out within 15 minutes. This phone stays signed in.`}
          confirmLabel="Log out others"
          loading={logoutOthers.isPending}
          error={logoutOthers.isError ? getErrorMessage(logoutOthers.error) : null}
          onCancel={() => setConfirmOthers(false)}
          onConfirm={() =>
            logoutOthers.mutate(undefined, { onSuccess: () => setConfirmOthers(false) })
          }
        />

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
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  link: { color: colors.primary, fontFamily: fonts.medium },
  linkOff: { color: colors.muted },
  devices: { padding: spacing.lg, gap: spacing.md },
  device: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  deviceName: { fontFamily: fonts.medium, fontSize: 15 },
  thisDevice: { fontFamily: fonts.medium, fontSize: 13, color: colors.success },
  settingsLoading: { marginVertical: spacing.lg },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  rowNote: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, marginTop: -4 },
  pressed: { backgroundColor: colors.background },
  logout: { marginTop: spacing.sm },
  deleteLink: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  deleteText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.danger },
  version: { textAlign: 'center', marginTop: -spacing.sm },
});
