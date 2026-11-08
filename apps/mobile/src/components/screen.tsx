import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  /** Row above the content, e.g. a back or close button. */
  header?: ReactNode;
  /** Full-width bar above the content with no padding (e.g. NavHeader). */
  navHeader?: ReactNode;
  /** Pinned to the bottom of the scroll content (pushed down when content is short). */
  footer?: ReactNode;
  /** Fixed bar outside the scroll area with a top border (main actions). */
  bottomBar?: ReactNode;
  background?: string;
};

/** Scrollable, keyboard-aware screen with safe-area padding. */
export function Screen({
  children,
  header,
  navHeader,
  footer,
  bottomBar,
  background = colors.surface,
}: Props) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {navHeader}
        {header ? <View style={styles.header}>{header}</View> : null}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
        {bottomBar ? <View style={styles.bottomBar}>{bottomBar}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.md, minHeight: 44, justifyContent: 'center' },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  body: { gap: spacing.lg },
  footer: { marginTop: 'auto', paddingTop: spacing.xl, alignItems: 'center' },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
});
