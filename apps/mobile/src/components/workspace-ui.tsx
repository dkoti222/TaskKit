import { StyleSheet, Text, View } from 'react-native';

import type { Role } from '@/api/types';
import { initials, workspaceInitials } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/roles';
import { colors, fonts } from '@/theme';

const ROLE_LOOK: Record<Role, { bg: string; text: string }> = {
  OWNER: { bg: colors.primarySoft, text: '#2A46C4' },
  ADMIN: { bg: '#F1EAFE', text: '#6B3FD0' },
  MEMBER: { bg: colors.successSoft, text: '#0E7A57' },
  VIEWER: { bg: '#EEF0F3', text: colors.muted },
};

/** Small pill showing a workspace role (Owner, Admin, Member, Viewer). */
export function RoleBadge({ role, prefix }: { role: Role; prefix?: string }) {
  const look = ROLE_LOOK[role];
  return (
    <View style={[styles.badge, { backgroundColor: look.bg }]}>
      <Text style={[styles.badgeText, { color: look.text }]}>
        {prefix ? `${prefix} ` : ''}
        {ROLE_LABEL[role]}
      </Text>
    </View>
  );
}

// Tile colours from the design. A workspace keeps the same colour because it's picked from its id.
const TILE_COLORS = ['#2F5BEA', '#12936A', '#8B5CF6', '#E8833A', '#D9435A'];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return TILE_COLORS[Math.abs(hash) % TILE_COLORS.length];
}

/** Rounded square with the workspace's initials (used until logo upload exists). */
export function WorkspaceTile({
  name,
  seed,
  size = 44,
}: {
  name: string;
  /** Usually the workspace id; decides the colour. */
  seed: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.25, backgroundColor: colorFor(seed) },
      ]}>
      <Text style={[styles.tileText, { fontSize: size * 0.36 }]}>
        {workspaceInitials(name) || '–'}
      </Text>
    </View>
  );
}

// Soft background + strong text pairs for people's initials (Members list).
const AVATAR_COLORS = [
  { bg: colors.primarySoft, text: '#2A46C4' },
  { bg: '#F1EAFE', text: '#6B3FD0' },
  { bg: colors.successSoft, text: '#0E7A57' },
  { bg: '#FDEEE2', text: '#B5561A' },
  { bg: '#FBEAEC', text: '#B42335' },
];

/** Round avatar with a person's initials. */
export function MemberAvatar({
  name,
  seed,
  size = 36,
}: {
  name: string;
  seed: string;
  size?: number;
}) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const look = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: look.bg },
      ]}>
      <Text style={[styles.avatarText, { color: look.text, fontSize: size * 0.36 }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarText: { fontFamily: fonts.semibold },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'center' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: fonts.bold, color: colors.surface },
});
