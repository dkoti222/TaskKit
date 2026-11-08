import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { forgotPassword } from '@/api/auth';
import { getErrorMessage } from '@/api/errors';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { InfoNote } from '@/components/info-note';
import { FooterPrompt, FormMessage, IconButton, IconTile } from '@/components/misc';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { isEmail } from '@/lib/validation';
import { spacing } from '@/theme';

// 05 · Forgot password
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({ mutationFn: forgotPassword });

  const goToLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const submit = () => {
    if (mutation.isPending) return;
    const trimmed = email.trim().toLowerCase();
    if (!isEmail(trimmed)) return setFormError('Enter a valid email address.');
    setFormError(null);
    mutation.mutate({ email: trimmed });
  };

  const error = formError ?? (mutation.isError ? getErrorMessage(mutation.error) : null);

  return (
    <Screen
      header={<IconButton icon="chevron-left" label="Go back" onPress={goToLogin} />}
      footer={<FooterPrompt prompt="Remembered it?" action="Back to log in" onPress={goToLogin} />}>
      <View style={styles.heading}>
        <IconTile icon="lock" />
        <AppText variant="title" style={styles.title}>
          Reset your password
        </AppText>
        <AppText variant="secondary">
          Enter the email you signed up with and we’ll send you a reset link.
        </AppText>
      </View>

      <TextField
        label="Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (mutation.isSuccess) mutation.reset();
        }}
        placeholder="ravi@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
      />

      <Button
        title={mutation.isSuccess ? 'Send again' : 'Send reset link'}
        onPress={submit}
        loading={mutation.isPending}
      />
      <FormMessage message={error} />
      {/* Same message whether or not the email exists, so accounts can't be discovered. */}
      <FormMessage tone="success" message={mutation.isSuccess ? mutation.data.message : null} />

      <InfoNote icon="clock">
        The link expires in 30 minutes. Resetting signs you out on all other devices.
      </InfoNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.sm },
  title: { marginTop: spacing.sm },
});
