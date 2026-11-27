import Feather from '@expo/vector-icons/Feather';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/errors';
import { listAuditLog, type AuditEntry } from '@/api/workspaces';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { NavHeader } from '@/components/nav-header';
import { MemberAvatar } from '@/components/workspace-ui';
import { useMe } from '@/hooks/use-me';
import { useWorkspace } from '@/hooks/use-workspaces';
import { dayLabel, firstName, timeAgo } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/roles';
import type { Role } from '@/api/types';
import { colors, fonts, spacing } from '@/theme';

const role = (value: unknown) =>
  typeof value === 'string' ? (ROLE_LABEL[value as Role] ?? value) : '';

/** "changed Sana's role from Member to Admin" (after the actor's name). */
function describe(e: AuditEntry, meId?: string): string {
  const who =
    e.targetId === meId ? 'your' : `${e.targetName ? firstName(e.targetName) : 'someone'}’s`;
  const them = e.targetId === meId ? 'you' : e.targetName ? firstName(e.targetName) : 'someone';
  const p = e.payload;
  switch (e.action) {
    case 'ROLE_CHANGED':
      return `changed ${who} role from ${role(p.from)} to ${role(p.to)}`;
    case 'MEMBER_REMOVED':
      return `removed ${them} from the workspace`;
    case 'MEMBER_LEFT':
      return 'left the workspace';
    case 'MEMBER_JOINED':
      return `joined as ${role(p.role)}`;
    case 'OWNERSHIP_TRANSFERRED':
      return `made ${them} the Owner`;
    case 'INVITATION_SENT':
      return `invited ${String(p.email ?? 'someone')} as ${role(p.role)}`;
    case 'INVITATION_REVOKED':
      return 'revoked an invite';
    case 'SETTINGS_CHANGED': {
      const parts: string[] = [];
      if (p.name !== undefined) parts.push('the name');
      if (p.description !== undefined) parts.push('the description');
      if (p.membersCanCreateBoards !== undefined)
        parts.push(`“Members can create boards” ${p.membersCanCreateBoards ? 'on' : 'off'}`);
      if (p.allowInviteLinks !== undefined)
        parts.push(`“Allow invite links” ${p.allowInviteLinks ? 'on' : 'off'}`);
      return parts.length ? `changed ${parts.join(', ')}` : 'changed the settings';
    }
    case 'LOGO_CHANGED':
      return p.removed ? 'removed the logo' : 'changed the logo';
    default:
      return 'made a change';
  }
}

// Workspace audit log (Owner, Admin): membership, roles, ownership and settings changes.
export default function AuditLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspace = useWorkspace(id);
  const me = useMe();
  const log = useInfiniteQuery({
    queryKey: ['workspaces', id, 'audit-log'],
    queryFn: ({ pageParam }) => listAuditLog(id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchOnMount: 'always',
  });

  const sections = useMemo(() => {
    const groups: { title: string; data: AuditEntry[] }[] = [];
    for (const e of log.data?.pages.flatMap((p) => p.items) ?? []) {
      const title = dayLabel(e.createdAt);
      const last = groups[groups.length - 1];
      if (last?.title === title) last.data.push(e);
      else groups.push({ title, data: [e] });
    }
    return groups;
  }, [log.data]);

  const goBack = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/workspace/[id]/settings', params: { id } });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <NavHeader title="Audit log" subtitle={workspace.data?.name} onBack={goBack} />
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <AppText variant="small" style={styles.day} accessibilityRole="header">
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <MemberAvatar name={item.actor.name} seed={item.actor.id} size={30} />
            <View style={styles.flex}>
              <Text style={styles.sentence}>
                <Text style={styles.strong}>
                  {item.actor.id === me.data?.id ? 'You' : firstName(item.actor.name)}
                </Text>{' '}
                {describe(item, me.data?.id)}
              </Text>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          log.isPending ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : log.isError ? (
            <View style={styles.message}>
              <AppText variant="secondary" style={styles.center}>
                {getErrorMessage(log.error)}
              </AppText>
              <Button title="Try again" variant="secondary" onPress={() => log.refetch()} />
            </View>
          ) : (
            <View style={styles.message}>
              <Feather name="shield" size={22} color={colors.muted} />
              <AppText variant="secondary" style={styles.center}>
                Role changes, invites and settings changes will show here.
              </AppText>
            </View>
          )
        }
        onEndReached={() => {
          if (log.hasNextPage && !log.isFetchingNextPage) void log.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          log.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} style={styles.more} />
          ) : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={log.isRefetching && !log.isFetchingNextPage}
            onRefresh={() => void log.refetch()}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  day: { marginTop: spacing.lg, marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  flex: { flex: 1 },
  sentence: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  strong: { fontFamily: fonts.semibold },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  loading: { marginTop: spacing.xxl },
  more: { marginVertical: spacing.lg },
  message: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  center: { textAlign: 'center' },
});
