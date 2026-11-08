import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { colors, radius, spacing } from '@/theme';

type Props = {
  visible: boolean;
  icon?: ComponentProps<typeof Feather>['name'];
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  /** Shown under the buttons when the action failed. */
  error?: string | null;
};

/** 27 · Confirm dialog. Nothing is sent to the API until the user confirms. */
export function ConfirmDialog({
  visible,
  icon = 'alert-triangle',
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
  error,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={loading ? undefined : onCancel}>
        {/* Inner Pressable stops taps on the card from closing it. */}
        <Pressable style={styles.card} onPress={() => {}} accessibilityViewIsModal>
          <View style={styles.iconTile}>
            <Feather name={icon} size={20} color={colors.danger} />
          </View>
          <AppText variant="heading" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="secondary" style={styles.message}>
            {message}
          </AppText>
          <View style={styles.actions}>
            <Button title={confirmLabel} variant="danger" onPress={onConfirm} loading={loading} />
            <Button title="Cancel" variant="secondary" onPress={onCancel} disabled={loading} />
          </View>
          {error ? (
            <AppText variant="small" style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(22, 24, 29, 0.55)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card + 2,
    padding: spacing.lg + 2,
    gap: spacing.sm,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  message: { fontSize: 14, lineHeight: 21 },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  error: { color: colors.danger, textAlign: 'center' },
});
