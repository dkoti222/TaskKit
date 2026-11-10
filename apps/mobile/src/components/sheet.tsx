import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { colors, fonts, spacing } from '@/theme';

/** Bottom sheet over a dimmed backdrop (25 · List actions, 26 · Move card). Tap outside to close. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  dismissable = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** False while a request is running, so a stray tap doesn't hide its result. */
  dismissable?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const close = dismissable ? onClose : () => {};
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          accessibilityViewIsModal>
          <View style={styles.handle} />
          {title ? (
            <View style={styles.head}>
              <AppText style={styles.title} accessibilityRole="header" numberOfLines={1}>
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="small" numberOfLines={1}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
          ) : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** One row in a sheet: icon, label, optional value on the right. */
export function SheetRow({
  icon,
  label,
  value,
  onPress,
  danger,
  disabled,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const color = danger ? colors.danger : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.background },
        disabled && { opacity: 0.45 },
      ]}>
      <Feather name={icon} size={19} color={color} />
      <Text style={[styles.rowLabel, { color }, danger && { fontFamily: fonts.semibold }]}>
        {label}
      </Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </Pressable>
  );
}

export const SheetDivider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(22, 24, 29, 0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  head: {
    paddingHorizontal: spacing.lg + 2,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 52,
    paddingHorizontal: spacing.lg + 2,
  },
  rowLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 15 },
  rowValue: { fontSize: 13, color: colors.muted },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs },
});
