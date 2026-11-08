import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { getErrorMessage } from '@/api/errors';
import { updateMe } from '@/api/users';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { meQueryKey, useMe } from '@/hooks/use-me';
import { colors, spacing } from '@/theme';

// Opened from Profile → Edit. Uses PATCH /me.
export default function EditProfileScreen() {
  const me = useMe();
  const queryClient = useQueryClient();
  const [name, setName] = useState<string | null>(null); // null = not edited yet
  const [formError, setFormError] = useState<string | null>(null);
  const value = name ?? me.data?.name ?? '';

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  const mutation = useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryKey, user);
      goBack();
    },
  });

  const submit = () => {
    if (mutation.isPending) return;
    const trimmed = value.trim();
    if (trimmed.length < 2) return setFormError('Enter your full name.');
    if (trimmed.length > 50) return setFormError('Name must be 50 characters or fewer.');
    setFormError(null);
    mutation.mutate({ name: trimmed });
  };

  const error = formError ?? (mutation.isError ? getErrorMessage(mutation.error) : null);

  return (
    <Screen
      navHeader={<NavHeader title="Edit profile" onBack={goBack} backIcon="x" />}
      bottomBar={
        <Button
          title="Save changes"
          onPress={submit}
          loading={mutation.isPending}
          disabled={!me.data}
        />
      }>
      {me.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : me.isError ? (
        <View style={styles.top}>
          <FormMessage message={getErrorMessage(me.error)} />
          <Button title="Try again" variant="secondary" onPress={() => me.refetch()} />
        </View>
      ) : (
        <View style={styles.top}>
          <TextField
            label="Full name"
            value={value}
            onChangeText={setName}
            placeholder="Ravi Kumar"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="done"
            onSubmitEditing={submit}
            maxLength={50}
            invalid={!!error}
          />
          <View style={styles.readOnly}>
            <AppText variant="label">Email</AppText>
            <AppText variant="secondary">{me.data.email}</AppText>
          </View>
          <FormMessage message={error} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  top: { gap: spacing.lg, marginTop: spacing.xl },
  readOnly: { gap: spacing.xs },
});
