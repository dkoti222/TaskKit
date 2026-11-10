import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { queryClient } from '@/api/query-client';
import { usePendingInvite } from '@/store/pending-invite';
import { useSession } from '@/store/session';
import { colors, fontAssets } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // If Inter fails to load we still continue; text falls back to the system font.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const status = useSession((s) => s.status);
  const hydrate = useSession((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
    void usePendingInvite.getState().hydrate();
  }, [hydrate]);

  const ready = (fontsLoaded || !!fontError) && status !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Keep the splash screen up until we know who the user is. Rendering the navigator earlier
  // would briefly treat everyone as logged out and break deep links into logged-in screens.
  if (!ready) return null;

  const signedIn = status === 'signedIn';

  return (
    // Gesture root for drag and drop on the board (react-native-draggable-flatlist).
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
          {/* Logged-in screens. Logged-out users are sent to Welcome. */}
          <Stack.Protected guard={signedIn} redirectTo="/welcome">
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
            <Stack.Screen name="delete-account" />
            <Stack.Screen name="new-workspace" options={{ presentation: 'modal' }} />
            <Stack.Screen name="workspace/[id]/index" />
            <Stack.Screen name="workspace/[id]/members" />
            <Stack.Screen name="workspace/[id]/settings" />
            <Stack.Screen name="workspace/[id]/invite" options={{ presentation: 'modal' }} />
            <Stack.Screen name="workspace/[id]/new-board" options={{ presentation: 'modal' }} />
            <Stack.Screen name="workspace/[id]/archived" />
            <Stack.Screen name="workspace/[id]/transfer" options={{ presentation: 'modal' }} />
            <Stack.Screen name="board/[id]/index" />
            <Stack.Screen name="board/[id]/settings" />
            <Stack.Screen name="board/[id]/add-people" options={{ presentation: 'modal' }} />
            <Stack.Screen name="board/[id]/new-card" options={{ presentation: 'modal' }} />
            <Stack.Screen name="join" options={{ presentation: 'modal' }} />
          </Stack.Protected>

          {/* Logged-out screens. Logged-in users are sent to Home. */}
          <Stack.Protected guard={!signedIn} redirectTo="/">
            <Stack.Screen name="welcome" />
            <Stack.Screen name="login" />
            <Stack.Screen name="sign-up" />
            <Stack.Screen name="verify-email" />
            <Stack.Screen name="forgot-password" />
          </Stack.Protected>

          {/* Opened from the emailed link (taskkit://reset-password?token=…), logged in or not. */}
          <Stack.Screen name="reset-password" />
          {/* taskkit://invite/<token>. Outside the guards so a logged-out user's token isn't lost. */}
          <Stack.Screen name="invite/[token]" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
