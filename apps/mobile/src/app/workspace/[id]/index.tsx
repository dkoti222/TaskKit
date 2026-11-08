import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage, getErrorStatus } from '@/api/errors';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { IconButton } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { RoleBadge, WorkspaceTile } from '@/components/workspace-ui';
import { useWorkspace } from '@/hooks/use-workspaces';
import { plural } from '@/lib/format';
import { canManageWorkspace } from '@/lib/roles';
import { colors, fonts, radius, spacing } from '@/theme';

// Placeholder for 08 · Workspace boards until the boards API exists.
export default function WorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspace = useWorkspace(id);

  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openMembers = () => router.push({ pathname: '/workspace/[id]/members', params: { id } });
  const openSettings = () => router.push({ pathname: '/workspace/[id]/settings', params: { id } });

  // 404 = not a member (or never was). Matches 31 · Access removed in spirit.
  if (workspace.isError && getErrorStatus(workspace.error) === 404) {
    return (
      <SafeAreaView style={styles.safe}>
        <NavHeader title="Workspace" onBack={goHome} />
        <View style={styles.center}>
          <View style={styles.lockTile}>
            <Feather name="lock" size={24} color={colors.muted} />
          </View>
          <AppText variant="heading" style={styles.centerTitle}>
            You don{'’'}t have access to this workspace
          </AppText>
          <AppText variant="secondary" style={styles.centerText}>
            You may have been removed, or the workspace was deleted.
          </AppText>
          <Button
            title="Go to all workspaces"
            onPress={() => router.replace('/')}
            style={styles.stretch}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <NavHeader
        title={workspace.data?.name ?? 'Workspace'}
        onBack={goHome}
        right={
          workspace.data ? <IconButton icon="users" label="Members" onPress={openMembers} /> : null
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={workspace.isRefetching}
            onRefresh={() => void workspace.refetch()}
            tintColor={colors.primary}
          />
        }>
        {workspace.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : workspace.isError ? (
          <View style={styles.card}>
            <AppText variant="secondary" style={{ color: colors.danger }}>
              {getErrorMessage(workspace.error)}
            </AppText>
            <Button title="Try again" variant="secondary" onPress={() => workspace.refetch()} />
          </View>
        ) : (
          <>
            <View style={styles.summary}>
              <WorkspaceTile name={workspace.data.name} seed={workspace.data.id} size={52} />
              <View style={styles.flex}>
                <AppText style={styles.name} numberOfLines={2}>
                  {workspace.data.name}
                </AppText>
                <AppText variant="small">{plural(workspace.data.memberCount, 'member')}</AppText>
              </View>
              <RoleBadge role={workspace.data.role} prefix="You're" />
            </View>
            {workspace.data.description ? (
              <AppText variant="secondary">{workspace.data.description}</AppText>
            ) : null}

            <View style={[styles.card, styles.links]}>
              <LinkRow
                icon="users"
                title="Members and roles"
                detail={String(workspace.data.memberCount)}
                onPress={openMembers}
              />
              {canManageWorkspace(workspace.data.role) ? (
                <LinkRow
                  icon="settings"
                  title="Workspace settings"
                  onPress={openSettings}
                  divider
                />
              ) : null}
            </View>

            <View style={[styles.card, styles.placeholder]}>
              <Feather name="columns" size={22} color={colors.muted} />
              <AppText variant="label">Boards are coming soon</AppText>
              <AppText variant="small" style={styles.centerText}>
                This is where the workspace{'’'}s boards will show.
              </AppText>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LinkRow({
  icon,
  title,
  detail,
  onPress,
  divider,
}: {
  icon: 'users' | 'settings';
  title: string;
  detail?: string;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.linkRow,
        divider && styles.divider,
        pressed && styles.pressed,
      ]}>
      <Feather name={icon} size={18} color={colors.muted} />
      <AppText style={styles.linkText}>{title}</AppText>
      {detail ? <AppText variant="small">{detail}</AppText> : null}
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  links: { padding: 0, gap: 0, overflow: 'hidden' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  linkText: { flex: 1, fontSize: 15 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  pressed: { backgroundColor: colors.background },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: spacing.lg, gap: spacing.lg },
  flex: { flex: 1 },
  loading: { marginTop: spacing.xxl },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  placeholder: { alignItems: 'center', paddingVertical: spacing.xl },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  lockTile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#EEF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  centerTitle: { textAlign: 'center' },
  centerText: { textAlign: 'center' },
  stretch: { alignSelf: 'stretch', marginTop: spacing.lg },
});
