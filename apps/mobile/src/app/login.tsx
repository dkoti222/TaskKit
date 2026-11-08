import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { login } from '@/api/auth';
import { getErrorMessage } from '@/api/errors';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FooterPrompt, FormMessage, IconButton, TextLink } from '@/components/misc';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { isEmail } from '@/lib/validation';
import { useSession } from '@/store/session';
import { spacing } from '@/theme';

// 02 · Log in
export default function LoginScreen() {
  const signIn = useSession((s) => s.signIn);
  // Read the notice once (e.g. "Your session expired…"), then clear it from the store.
  const [notice] = useState(() => useSession.getState().notice);
  useEffect(() => {
    useSession.getState().clearNotice();
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const mutation = useMutation({
    mutationFn: login,
    // The route guard sees status 'signedIn' and shows home; no manual navigation needed.
    onSuccess: ({ accessToken, refreshToken }) => signIn({ accessToken, refreshToken }),
  });

  const submit = () => {
    if (mutation.isPending) return;
    const trimmed = email.trim();
    if (!isEmail(trimmed)) return setFormError('Enter a valid email address.');
    if (!password) return setFormError('Enter your password.');
    setFormError(null);
    mutation.mutate({ email: trimmed, password });
  };

  const error = formError ?? (mutation.isError ? getErrorMessage(mutation.error) : null);

  return (
    <Screen
      header={
        <IconButton
          icon="chevron-left"
          label="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
        />
      }
      footer={
        <FooterPrompt
          prompt="New to TaskKit?"
          action="Create account"
          onPress={() => router.replace('/sign-up')}
        />
      }>
      <View style={styles.heading}>
        <AppText variant="title">Welcome back</AppText>
        <AppText variant="secondary">Log in to your workspaces.</AppText>
      </View>

      {notice ? <FormMessage tone={notice.tone} message={notice.message} /> : null}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="ravi@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={passwordRef}
        label="Password"
        labelAccessory={
          <TextLink title="Forgot password?" onPress={() => router.push('/forgot-password')} />
        }
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button title="Log in" onPress={submit} loading={mutation.isPending} style={styles.cta} />
      <FormMessage message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.sm },
  cta: { marginTop: spacing.xs },
});
