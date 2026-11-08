import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconTile } from '@/components/misc';

type Props = {
  title: string;
  /** Optional soft-blue icon tile above the title (Verify email, Reset password). */
  icon?: ComponentProps<typeof Feather>['name'];
  children: ReactNode;
};

/** Title block used at the top of every auth screen, spaced like the PDF designs. */
export function AuthHeading({ title, icon, children }: Props) {
  return (
    <View style={styles.wrapper}>
      {icon ? (
        <View style={styles.tile}>
          <IconTile icon={icon} />
        </View>
      ) : null}
      <AppText variant="title">{title}</AppText>
      <AppText variant="secondary" style={styles.subtitle}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 28, marginBottom: 12 },
  tile: { marginBottom: 20 },
  subtitle: { marginTop: 6 },
});
