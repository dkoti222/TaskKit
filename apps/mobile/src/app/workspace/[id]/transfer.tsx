import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import type { Member } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { InfoNote } from '@/components/info-note';
import { FormMessage } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { Screen } from '@/components/screen';
import { MemberAvatar, RoleBadge } from '@/components/workspace-ui';
import { useMe } from '@/hooks/use-me';
import { useTransferOwnership } from '@/hooks/use-workspace-mutations';
import { useMembers, useWorkspace } from '@/hooks/use-workspaces';
import { firstName } from '@/lib/format';
import { colors, fonts, radius, spacing } from '@/theme';

// Transfer ownership (24 · Workspace settings › Danger zone). Owner only.
// POST /workspaces/:id/transfer-ownership — the chosen member becomes Owner, you become Admin.
export default function TransferOwnershipScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const workspace = useWorkspace(id);
  const members = useMembers(id);
  const transfer = useTransferOwnership(id);

  const [selected, setSelected] = useState<Member | null>(null);
  const [confirming, setConfirming] = useState(false);

  const close = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/workspace/[id]/settings', params: { id } });

  const isOwner = workspace.data?.role === 'OWNER';
  // Admins first: they're the usual choice for a new Owner.
  const candidates = (members.data ?? [])
    .filter((m) => m.userId !== me.data?.id)
    .sort((a, b) => Number(b.role === 'ADMIN') - Number(a.role === 'ADMIN'));

  const confirm = () =>
    selected &&
    transfer.mutate(selected.userId, {
      onSuccess: () => {
        setConfirming(false);
        close();
      },
    });

  return (
    <Screen
      navHeader={<NavHeader title="Transfer ownership" onBack={close} backIcon="x" />}
      bottomBar={
        isOwner && candidates.length ? (
          <Button
            title={selected ? `Make ${firstName(selected.name)} the Owner` : 'Choose a member'}
            disabled={!selected}
            onPress={() => {
              transfer.reset();
              setConfirming(true);
            }}
          />
        ) : undefined
      }>
      <View style={styles.top}>
        {workspace.isPending || members.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : !isOwner ? (
          <InfoNote icon="lock">Only the workspace Owner can transfer ownership.</InfoNote>
        ) : candidates.length === 0 ? (
          <InfoNote icon="users">
            {'You’re the only member. Invite someone first, then make them the Owner.'}
          </InfoNote>
        ) : (
          <>
            <AppText variant="secondary">
              Choose who will own {workspace.data?.name}. You{'’'}ll become an Admin, and only the
              new Owner can give ownership back.
            </AppText>
            <View accessibilityRole="radiogroup" style={styles.list}>
              {candidates.map((m, index) => {
                const on = selected?.userId === m.userId;
                return (
                  <Pressable
                    key={m.userId}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${m.name}, ${m.email}`}
                    onPress={() => setSelected(m)}
                    style={({ pressed }) => [
                      styles.row,
                      index > 0 && styles.divider,
                      on && styles.rowOn,
                      pressed && styles.pressed,
                    ]}>
                    <View style={[styles.radio, on && styles.radioOn]}>
                      {on ? <View style={styles.radioDot} /> : null}
                    </View>
                    <MemberAvatar name={m.name} seed={m.userId} size={34} />
                    <View style={styles.flex}>
                      <AppText style={styles.name} numberOfLines={1}>
                        {m.name}
                      </AppText>
                      <AppText variant="small" numberOfLines={1}>
                        {m.email}
                      </AppText>
                    </View>
                    <RoleBadge role={m.role} />
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        <FormMessage message={members.isError ? getErrorMessage(members.error) : null} />
      </View>

      <ConfirmDialog
        visible={confirming}
        icon="key"
        title={`Make ${selected?.name ?? ''} the Owner?`}
        message={`${selected?.name ?? 'They'} will own ${workspace.data?.name ?? 'this workspace'} and every board in it. You'll become an Admin. This can only be undone by the new Owner.`}
        confirmLabel="Transfer ownership"
        loading={transfer.isPending}
        error={transfer.isError ? getErrorMessage(transfer.error) : null}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { gap: spacing.lg, marginTop: spacing.lg },
  loading: { marginTop: spacing.xxl },
  list: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowOn: { backgroundColor: '#F4F7FF' },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  pressed: { opacity: 0.7 },
  name: { fontFamily: fonts.medium, fontSize: 15 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
