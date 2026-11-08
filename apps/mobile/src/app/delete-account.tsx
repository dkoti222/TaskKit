import Feather from '@expo/vector-icons/Feather';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import { deleteMe } from '@/api/users';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

// 32 · Delete account (required by the app stores)
// The "You own <workspace>" warning from the design is added once workspaces exist.
export default function DeleteAccountScreen() {
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: deleteMe,
    // The API already revoked every session; clear this device. The guard then leaves this screen.
    onSuccess: () =>
      useSession.getState().signOut({ tone: 'success', message: 'Your account has been deleted.' }),
  });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  const submit = () => {
    if (mutation.isPending) return;
    if (!password) return setFormError('Enter your password to confirm.');
    setFormError(null);
    mutation.mutate({ password });
  };

  const error = formError ?? (mutation.isError ? getErrorMessage(mutation.error) : null);

  return (
    <Screen
      navHeader={<NavHeader title="Delete account" onBack={goBack} />}
      bottomBar={
        <>
          <Button
            title="Delete my account"
            variant="danger"
            onPress={submit}
            loading={mutation.isPending}
          />
          <Button title="Keep my account" variant="text" onPress={goBack} />
        </>
      }>
      <View style={styles.heading}>
        <AppText variant="title" style={styles.title}>
          Delete your TaskKit account?
        </AppText>
        <AppText variant="secondary">This can{'’'}t be undone. Here{'’'}s what happens:</AppText>
      </View>

      <View style={styles.list}>
        <Consequence icon="x" danger>
          Your profile, login and devices are removed.
        </Consequence>
        <Consequence icon="x" danger>
          You leave every workspace you{'’'}re in.
        </Consequence>
        <Consequence icon="user">
          Cards and comments you made stay for your team, shown as {'“'}Deleted user{'”'}.
        </Consequence>
      </View>

      <TextField
        label="Enter your password to confirm"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={submit}
        invalid={!!error}
      />
      <FormMessage message={error} />
    </Screen>
  );
}

function Consequence({
  icon,
  danger,
  children,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.item}>
      <Feather name={icon} size={18} color={danger ? colors.danger : colors.muted} style={styles.icon} />
      <AppText style={styles.itemText}>{children}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.md, marginTop: spacing.xl },
  title: { fontSize: 24, lineHeight: 30 },
  list: { gap: spacing.md, marginBottom: spacing.sm },
  item: { flexDirection: 'row', gap: spacing.md },
  icon: { marginTop: 2 },
  itemText: { flex: 1, fontSize: 15, lineHeight: 22 },
});
