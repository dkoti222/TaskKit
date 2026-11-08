import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/misc';
import { colors, fonts, spacing } from '@/theme';

type Props = {
  title: string;
  onBack: () => void;
  backIcon?: 'chevron-left' | 'x';
};

/** Top bar with a back button, a centred title and a bottom border (Delete account, Edit profile). */
export function NavHeader({ title, onBack, backIcon = 'chevron-left' }: Props) {
  return (
    <View style={styles.bar}>
      <IconButton icon={backIcon} label={backIcon === 'x' ? 'Close' : 'Go back'} onPress={onBack} />
      <AppText style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </AppText>
      <View style={styles.spacer} />
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
  spacer: { width: 44 },
});
