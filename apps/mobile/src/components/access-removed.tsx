import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { MemberAvatar } from '@/components/workspace-ui';
import { firstName } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/roles';
import type { Role } from '@/api/types';
import { colors, fonts, spacing } from '@/theme';

type Action = { title: string; onPress: () => void };

/** 31 · Access removed. Shown when a board or workspace returns 404 (no access). */
export function AccessRemoved({
  title,
  message,
  primary,
  secondary,
  contact,
}: {
  title: string;
  message: string;
  primary: Action;
  secondary?: Action;
  /** Someone to ask about it (a workspace Admin or the Owner). */
  contact?: { id: string; name: string; role: Role };
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <View style={styles.lockTile}>
          <Feather name="lock" size={24} color={colors.muted} />
        </View>
        <AppText variant="heading" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        <AppText variant="secondary" style={styles.message}>
          {message}
        </AppText>
        {contact ? (
          <View
            style={styles.contact}
            accessible
            accessibilityLabel={`${contact.name}, ${ROLE_LABEL[contact.role]}. Ask ${firstName(contact.name)} if you think this is a mistake.`}>
            <MemberAvatar name={contact.name} seed={contact.id} size={32} />
            <View style={styles.contactText}>
              <AppText style={styles.contactName}>
                {contact.name} <AppText variant="small">· {ROLE_LABEL[contact.role]}</AppText>
              </AppText>
              <AppText variant="small">
                Ask {firstName(contact.name)} if you think this is a mistake.
              </AppText>
            </View>
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Button title={primary.title} onPress={primary.onPress} />
        {secondary ? (
          <Button title={secondary.title} variant="secondary" onPress={secondary.onPress} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  lockTile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#EEF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { textAlign: 'center', fontSize: 20, lineHeight: 26 },
  message: { textAlign: 'center', fontSize: 14, lineHeight: 21 },
  actions: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  contactText: { flex: 1, gap: 2 },
  contactName: { fontSize: 14, fontFamily: fonts.semibold },
});
