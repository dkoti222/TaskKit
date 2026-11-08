import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  /** Row above the content, e.g. a back or close button. */
  header?: ReactNode;
  /** Pinned to the bottom of the screen (pushed down when content is short). */
  footer?: ReactNode;
  background?: string;
};

/** Scrollable, keyboard-aware screen with safe-area padding. */
export function Screen({ children, header, footer, background = colors.surface }: Props) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {header ? <View style={styles.header}>{header}</View> : null}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
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
});
