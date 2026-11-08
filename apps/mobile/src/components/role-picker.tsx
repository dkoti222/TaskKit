import Feather from '@expo/vector-icons/Feather';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AssignableRole, Role } from '@/api/types';
import { AppText } from '@/components/app-text';
import { ROLE_DESCRIPTION, ROLE_LABEL } from '@/lib/roles';
import { colors, fonts, radius, spacing } from '@/theme';

/** The bordered "Admin ⌄" control on each member row. */
export function RoleDropdown({
  role,
  onPress,
  disabled,
  label,
}: {
  role: Role;
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Change role or remove"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dropdown,
        pressed && styles.pressed,
        disabled && { opacity: 0.5 },
      ]}>
      <Text style={[styles.dropdownText, { color: ROLE_TEXT[role] }]}>{ROLE_LABEL[role]}</Text>
      <Feather name="chevron-down" size={16} color={colors.ink} />
    </Pressable>
  );
}

const ROLE_TEXT: Record<Role, string> = {
  OWNER: '#2A46C4',
  ADMIN: '#6B3FD0',
  MEMBER: '#0E7A57',
  VIEWER: colors.ink,
};

type SheetProps = {
  visible: boolean;
  title: string;
  current: Role;
  options: AssignableRole[];
  onSelect: (role: AssignableRole) => void;
  onRemove: () => void;
  onClose: () => void;
};

/** Radio cards with each role's name and description (Invite members, role sheet). */
export function RoleOptions({
  options,
  value,
  onChange,
}: {
  options: AssignableRole[];
  value: Role;
  onChange: (role: AssignableRole) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.options}>
      {options.map((role) => {
        const selected = role === value;
        return (
          <Pressable
            key={role}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${ROLE_LABEL[role]}. ${ROLE_DESCRIPTION[role]}`}
            onPress={() => onChange(role)}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              pressed && styles.pressed,
            ]}>
            <View style={[styles.radio, selected && styles.radioOn]}>
              {selected ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={styles.flex}>
              <AppText style={styles.optionTitle}>{ROLE_LABEL[role]}</AppText>
              <AppText variant="small">{ROLE_DESCRIPTION[role]}</AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom sheet listing the roles the current user may give, plus "Remove from workspace". */
export function RoleSheet({
  visible,
  title,
  current,
  options,
  onSelect,
  onRemove,
  onClose,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          onPress={() => {}}
          accessibilityViewIsModal>
          <View style={styles.grabber} />
          <AppText variant="heading" style={styles.sheetTitle}>
            {title}
          </AppText>
          <RoleOptions options={options} value={current} onChange={onSelect} />
          <Pressable
            accessibilityRole="button"
            onPress={onRemove}
            style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
            <Feather name="user-x" size={18} color={colors.danger} />
            <Text style={styles.removeText}>Remove from workspace</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { backgroundColor: colors.background },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    minWidth: 96,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dropdownText: { fontFamily: fonts.semibold, fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(22, 24, 29, 0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  sheetTitle: { marginBottom: spacing.xs },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: '#F4F7FF' },
  optionTitle: { fontFamily: fonts.semibold, fontSize: 15 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.control,
    marginTop: spacing.xs,
  },
  removeText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.danger },
});
