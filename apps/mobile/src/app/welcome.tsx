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
        <Logo />
      </View>

      <BoardPreview />

      <View style={styles.copy}>
        <AppText variant="title">Plan work with your team, board by board</AppText>
        <AppText variant="secondary">
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
        <MiniCard accent={ACCENTS.red} />
        <MiniCard />
      </Column>
      <Column title="Doing">
        <MiniCard accent={ACCENTS.orange} highlighted />
        <MiniCard />
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

function MiniCard({ accent, highlighted }: { accent?: string; highlighted?: boolean }) {
  return (
    <View style={[styles.miniCard, highlighted && styles.miniCardHighlighted]}>
      {accent ? <View style={[styles.accent, { backgroundColor: accent }]} /> : null}
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { marginTop: spacing.xl, marginBottom: spacing.sm },
  preview: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.background,
    minHeight: 170,
  },
  column: { flex: 1, gap: 6 },
  columnTitle: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, marginBottom: 2 },
  miniCard: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 7,
    gap: 5,
  },
  miniCardHighlighted: { borderColor: colors.primary },
  accent: { width: 22, height: 4, borderRadius: 2 },
  line: { height: 4, borderRadius: 2, backgroundColor: colors.divider, width: '80%' },
  copy: { gap: spacing.sm, marginTop: spacing.lg },
  actions: { alignSelf: 'stretch', gap: spacing.md },
});
