import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance } from 'react-native';

import { resetPassword } from '@/api/auth';
import { getErrorMessage } from '@/api/errors';
import { AuthHeading } from '@/components/auth-heading';
import { Button } from '@/components/button';
import { FooterPrompt, FormMessage, IconButton } from '@/components/misc';
import { PasswordStrength } from '@/components/password-strength';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { passwordProblem } from '@/lib/validation';
import { useSession } from '@/store/session';
import { spacing } from '@/theme';

// 23 · Set new password — opened from taskkit://reset-password?token=…
export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const status = useSession((s) => s.status);
  const signedIn = status === 'signedIn';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const confirmRef = useRef<TextInputInstance>(null);

  const mutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: async () => {
      // The API revoked every refresh token, including this device's, so sign out locally.
      await useSession.getState().signOut({
        tone: 'success',
        message: 'Password updated. Log in with your new password.',
      });
      setDone(true);
    },
  });

  // Navigate only after the route guard has switched to the logged-out screens.
  useEffect(() => {
    if (done && status === 'signedOut') router.replace('/login');
  }, [done, status]);

  const close = () =>
    router.canGoBack() ? router.back() : router.replace(signedIn ? '/' : '/welcome');
  const requestNewLink = () => router.replace('/forgot-password');

  const submit = () => {
    if (mutation.isPending || !token) return;
    const problem =
      passwordProblem(password) ?? (password !== confirm ? 'The passwords don’t match.' : null);
    setFormError(problem);
    if (!problem) mutation.mutate({ token, password });
  };

  const header = <IconButton icon="x" label="Close" onPress={close} />;
  // "Send a new one" leads to Forgot password, which is only available when logged out.
  const footer = signedIn ? undefined : (
    <FooterPrompt prompt="Link expired?" action="Send a new one" onPress={requestNewLink} />
  );

  if (!token) {
    return (
      <Screen header={header}>
        <AuthHeading icon="lock" title="This link is incomplete">
          Open the reset link from your email again, or request a new one.
        </AuthHeading>
        {signedIn ? null : <Button title="Request a new link" onPress={requestNewLink} />}
      </Screen>
    );
  }

  const error = formError ?? (mutation.isError ? getErrorMessage(mutation.error) : null);

  return (
    <Screen header={header} footer={footer}>
      <AuthHeading icon="lock" title="Set a new password">
        Choose a new password. You’ll be signed out on all your devices.
      </AuthHeading>

      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        placeholder="Create a password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        submitBehavior="submit"
        maxLength={72}
        autoFocus
      />
      <PasswordStrength password={password} showLabel />

      <TextField
        ref={confirmRef}
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Type it again"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={submit}
        maxLength={72}
      />

      <Button
        title="Save and log in"
        onPress={submit}
        loading={mutation.isPending || done}
        style={styles.cta}
      />
      <FormMessage message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: spacing.sm },
});
