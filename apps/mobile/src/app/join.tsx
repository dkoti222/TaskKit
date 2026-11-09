import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthHeading } from '@/components/auth-heading';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/misc';
import { NavHeader } from '@/components/nav-header';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { parseInviteToken } from '@/store/pending-invite';
import { spacing } from '@/theme';

// "I have an invite link" (28 · Empty state) and "Have an invite link?" (Home). Paste the link,
// then continue to 12 · Accept invite. Also handy in Expo Go, which can't open taskkit:// links.
export default function JoinWithLinkScreen() {
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const submit = () => {
    const token = parseInviteToken(link);
    if (!token)
      return setError('That doesn’t look like an invite link. Copy the whole link from the email.');
    setError(null);
    router.replace({ pathname: '/invite/[token]', params: { token } });
  };

  return (
    <Screen
      navHeader={<NavHeader title="Join a workspace" onBack={close} backIcon="x" />}
      bottomBar={<Button title="Continue" onPress={submit} disabled={!link.trim()} />}>
      <AuthHeading icon="link" title="Paste your invite link">
        Open the invite email, copy the link, and paste it here.
      </AuthHeading>
      <View style={styles.field}>
        <TextField
          label="Invite link"
          value={link}
          onChangeText={setLink}
          placeholder="taskkit://invite/…"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={submit}
          invalid={!!error}
        />
        <FormMessage message={error} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
});
