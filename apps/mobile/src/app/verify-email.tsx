import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { resendCode, verifyEmail } from '@/api/auth';
import { getErrorMessage } from '@/api/errors';
import { AppText } from '@/components/app-text';
import { AuthHeading } from '@/components/auth-heading';
import { Button } from '@/components/button';
import { CodeInput } from '@/components/code-input';
import { FooterPrompt, FormMessage, IconButton, TextLink } from '@/components/misc';
import { Screen } from '@/components/screen';
import { formatSeconds, useCountdown } from '@/hooks/use-countdown';
import { useSession } from '@/store/session';
import { colors, fonts, spacing } from '@/theme';

const CODE_LENGTH = 6;
const RESEND_WAIT_SECONDS = 60; // the API refuses a new code within 1 minute

// 04 · Verify email
// Params: email (required); sent=1 when a code was just sent (after sign up).
export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string; sent?: string }>();
  const email = params.email ?? '';
  const justSent = params.sent === '1';

  const signIn = useSession((s) => s.signIn);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const { remaining, restart } = useCountdown(justSent ? RESEND_WAIT_SECONDS : 0);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/sign-up'));

  const verify = useMutation({
    mutationFn: verifyEmail,
    // The route guard switches to the home screen once signed in.
    onSuccess: ({ accessToken, refreshToken }) => signIn({ accessToken, refreshToken }),
    onError: (error) => {
      setCode('');
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    },
  });

  const resend = useMutation({
    mutationFn: resendCode,
    onSuccess: () => {
      setCode('');
      setMessage({ tone: 'success', text: `We sent a new code to ${email}.` });
      restart(RESEND_WAIT_SECONDS);
    },
    onError: (error) => setMessage({ tone: 'error', text: getErrorMessage(error) }),
  });

  const submit = (value = code) => {
    if (verify.isPending) return;
    if (value.length !== CODE_LENGTH) {
      setMessage({ tone: 'error', text: 'Enter the 6-digit code from your email.' });
      return;
    }
    setMessage(null);
    verify.mutate({ email, code: value });
  };

  const onChangeCode = (value: string) => {
    setCode(value);
    if (message?.tone === 'error') setMessage(null);
    if (value.length === CODE_LENGTH) submit(value); // submit as soon as all digits are in
  };

  if (!email) {
    return (
      <Screen header={<IconButton icon="chevron-left" label="Go back" onPress={goBack} />}>
        <AppText variant="title">Something’s missing</AppText>
        <AppText variant="secondary">
          We don’t know which email to verify. Go back and sign up or log in again.
        </AppText>
        <Button title="Go back" onPress={goBack} />
      </Screen>
    );
  }

  return (
    <Screen
      header={<IconButton icon="chevron-left" label="Go back" onPress={goBack} />}
      footer={<FooterPrompt prompt="Wrong email?" action="Change it" onPress={goBack} />}>
      <AuthHeading icon="mail" title="Check your email">
        <>
          {justSent ? 'We sent a 6-digit code to ' : 'Your email isn’t verified yet. Enter the code we sent to '}
          <Text style={styles.email}>{email}</Text>
          {justSent ? '. Enter it below to verify your account.' : ', or ask for a new one.'}
        </>
      </AuthHeading>

      <CodeInput
        value={code}
        onChange={onChangeCode}
        length={CODE_LENGTH}
        invalid={message?.tone === 'error'}
        autoFocus
      />

      <Button
        title="Verify and continue"
        onPress={() => submit()}
        loading={verify.isPending}
        style={styles.cta}
      />
      <FormMessage tone={message?.tone} message={message?.text} />

      <View style={styles.resendRow}>
        <AppText variant="secondary">Didn’t get it? </AppText>
        {remaining > 0 ? (
          <AppText variant="secondary">
            Resend in <Text style={styles.timer}>{formatSeconds(remaining)}</Text>
          </AppText>
        ) : resend.isPending ? (
          <AppText variant="secondary">Sending…</AppText>
        ) : (
          <TextLink title="Resend code" onPress={() => resend.mutate({ email })} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: spacing.sm },
  email: { fontFamily: fonts.semibold, color: colors.ink },
  timer: { fontFamily: fonts.semibold, color: colors.ink },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
