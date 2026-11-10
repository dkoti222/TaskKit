import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/misc';
import { colors, fonts, spacing } from '@/theme';

type Props = {
  title: string;
  /** Small muted line under the title (e.g. "App v2 · To do"). */
  subtitle?: string;
  onBack: () => void;
  backIcon?: 'chevron-left' | 'x';
  /** Optional action at the right (e.g. "Invite", "Save"). Keeps the title centred. */
  right?: ReactNode;
};

/** Top bar with a back button, a centred title and a bottom border. */
export function NavHeader({ title, subtitle, onBack, backIcon = 'chevron-left', right }: Props) {
  return (
    <View style={styles.bar}>
      <IconButton icon={backIcon} label={backIcon === 'x' ? 'Close' : 'Go back'} onPress={onBack} />
      <View style={styles.titleBox}>
        <AppText style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
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
  titleBox: { flex: 1 },
  title: { textAlign: 'center', fontFamily: fonts.semibold, fontSize: 17 },
  subtitle: { textAlign: 'center', fontSize: 12, lineHeight: 16 },
  right: { minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
});
