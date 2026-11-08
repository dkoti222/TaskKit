import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/misc';
import { colors, fonts, spacing } from '@/theme';

type Props = {
  title: string;
  onBack: () => void;
  backIcon?: 'chevron-left' | 'x';
  /** Optional action at the right (e.g. "Invite", "Save"). Keeps the title centred. */
  right?: ReactNode;
};

/** Top bar with a back button, a centred title and a bottom border. */
export function NavHeader({ title, onBack, backIcon = 'chevron-left', right }: Props) {
  return (
    <View style={styles.bar}>
      <IconButton icon={backIcon} label={backIcon === 'x' ? 'Close' : 'Go back'} onPress={onBack} />
      <AppText style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </AppText>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 17 },
  right: { minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
});
