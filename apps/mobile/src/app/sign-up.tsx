import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type TextInputInstance } from 'react-native';

import { register } from '@/api/auth';
import { getErrorMessage } from '@/api/errors';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import { FooterPrompt, FormMessage, IconButton } from '@/components/misc';
import { PasswordStrength } from '@/components/password-strength';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { isEmail, passwordProblem } from '@/lib/validation';
import { colors, fonts, spacing } from '@/theme';

// 03 · Sign up
export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: (_data, variables) => {
      router.push({ pathname: '/verify-email', params: { email: variables.email, sent: '1' } });
    },
  });

  const submit = () => {
    if (mutation.isPending) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    let problem: string | null = null;
    if (trimmedName.length < 2) problem = 'Enter your full name.';
    else if (trimmedName.length > 50) problem = 'Name must be 50 characters or fewer.';
    else if (!isEmail(trimmedEmail)) problem = 'Enter a valid email address.';
    else problem = passwordProblem(password);
    if (!problem && !agreed) problem = 'Agree to the Terms and Privacy policy to continue.';

    setFormError(problem);
    if (!problem) mutation.mutate({ name: trimmedName, email: trimmedEmail, password });
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
          prompt="Already have an account?"
          action="Log in"
          onPress={() => router.replace('/login')}
        />
      }>
      <View style={styles.heading}>
        <AppText variant="title">Create your account</AppText>
        <AppText variant="secondary">Start a workspace or join your team.</AppText>
      </View>

      <TextField
        label="Full name"
        value={name}
        onChangeText={setName}
        placeholder="Ravi Kumar"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
        maxLength={50}
      />
      <TextField
        ref={emailRef}
        label="Work email"
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
        value={password}
        onChangeText={setPassword}
        placeholder="Create a password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        maxLength={72}
      />
      <View style={styles.strength}>
        <PasswordStrength password={password} />
        <AppText variant="small">At least 8 characters, with a number.</AppText>
      </View>

      <Checkbox
        checked={agreed}
        onChange={setAgreed}
        accessibilityLabel="I agree to the Terms and Privacy policy">
        <AppText variant="secondary">
          I agree to the <Text style={styles.linkText}>Terms</Text> and{' '}
          <Text style={styles.linkText}>Privacy policy</Text>
        </AppText>
      </Checkbox>

      <Button title="Create account" onPress={submit} loading={mutation.isPending} />
      <FormMessage message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.sm },
  strength: { gap: spacing.sm },
  linkText: { color: colors.primary, fontFamily: fonts.medium },
});
