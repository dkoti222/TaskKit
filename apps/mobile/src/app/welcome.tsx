import { Redirect, router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Logo } from '@/components/misc';
import { Screen } from '@/components/screen';
import { useSession } from '@/store/session';
import { colors, fonts, radius, spacing } from '@/theme';

// 01 · Welcome
export default function WelcomeScreen() {
  // After an expired session the guard lands here; send the user on to Log in with the message.
  const hasNotice = useSession((s) => !!s.notice);
  if (hasNotice) return <Redirect href="/login" />;

  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <Button title="Create account" onPress={() => router.push('/sign-up')} />
          <Button title="Log in" variant="secondary" onPress={() => router.push('/login')} />
        </View>
      }>
      <View style={styles.logo}>
        <Logo size={38} />
      </View>

      <BoardPreview />

      <View style={styles.copy}>
        <AppText variant="display">Plan work with your team, board by board</AppText>
        <AppText variant="secondary" style={styles.body}>
          Workspaces, boards and cards that update live for everyone, with the right access for
          each person.
        </AppText>
      </View>
    </Screen>
  );
}

const ACCENTS = { blue: colors.primary, orange: '#E8833A', green: colors.success, red: '#D9475B' };

/** Decorative mini board (To do / Doing / Done). Hidden from screen readers. */
function BoardPreview() {
  return (
    <View
      style={styles.preview}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Column title="To do">
        <MiniCard accent={ACCENTS.blue} />
        <MiniCard accent={ACCENTS.red} short />
        <MiniCard short />
      </Column>
      <Column title="Doing">
        <MiniCard accent={ACCENTS.orange} highlighted />
        <MiniCard short />
      </Column>
      <Column title="Done">
        <MiniCard accent={ACCENTS.green} />
      </Column>
    </View>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.column}>
      <AppText style={styles.columnTitle}>{title}</AppText>
      {children}
    </View>
  );
}

function MiniCard({
  accent,
  highlighted,
  short,
}: {
  accent?: string;
  highlighted?: boolean;
  short?: boolean;
}) {
  return (
    <View style={[styles.miniCard, highlighted && styles.miniCardHighlighted]}>
      {accent ? <View style={[styles.accent, { backgroundColor: accent }]} /> : null}
      <View style={[styles.line, short && styles.lineShort]} />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { marginTop: spacing.xl, marginBottom: spacing.xl },
  preview: {
    flexDirection: 'row',
    gap: 10,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.background,
    minHeight: 168,
  },
  column: { flex: 1, gap: 8 },
  columnTitle: { fontFamily: fonts.medium, fontSize: 12, color: '#3D424D', marginBottom: 2 },
  miniCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 9,
    gap: 7,
  },
  miniCardHighlighted: { borderColor: colors.primary },
  accent: { width: 32, height: 6, borderRadius: 3 },
  line: { height: 6, borderRadius: 3, backgroundColor: colors.divider, width: '88%' },
  lineShort: { width: '65%' },
  copy: { gap: spacing.md, marginTop: spacing.xl },
  body: { lineHeight: 24 },
  actions: { alignSelf: 'stretch', gap: spacing.md },
});
