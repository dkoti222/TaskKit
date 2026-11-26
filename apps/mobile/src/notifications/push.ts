import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { deletePushToken, savePushToken } from '@/api/notifications';
import { useSession } from '@/store/session';

/**
 * Push notifications (Step 11).
 *
 * Getting an Expo push token needs an EAS project id (`eas init` adds it to app.json as
 * expo.extra.eas.projectId). Expo Go on Android can't receive remote push at all since SDK 53;
 * that needs a development build. In both cases we skip push quietly: in-app notifications
 * (screen 19, live over the socket) still work.
 */

let registeredToken: string | null = null;

const projectId: string | undefined =
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Why push is off on this device, or null if it can work. Shown in Profile → Notifications. */
export function pushUnavailableReason(): string | null {
  if (Platform.OS === 'web') return 'Push notifications work on phones only.';
  if (!Device.isDevice) return 'Push notifications need a real phone, not a simulator.';
  if (isExpoGo && Platform.OS === 'android')
    return 'Expo Go on Android can’t receive push notifications. A development build can.';
  if (!projectId) return 'Push isn’t set up for this app yet (it needs an EAS project id).';
  return null;
}

// Show notifications that arrive while the app is open, too.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Asks for permission (once), gets this phone's Expo push token and saves it with the API. */
export async function registerForPush() {
  if (pushUnavailableReason()) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifications',
        importance: AndroidImportance.DEFAULT,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await savePushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
    registeredToken = token;
  } catch (error) {
    // Push is a bonus: never block the app over it.
    console.warn('Push registration failed', error);
  }
}

/** Before logging out: stop this phone getting the next person's… or anyone's pushes. */
export async function unregisterPush() {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await deletePushToken(token);
  } catch {
    // Best effort: the API also drops tokens Expo reports as dead.
  }
}

/** Tapping a push notification opens the card or the invitation. */
function openFromPush(data: Record<string, unknown> | undefined) {
  if (!data) return;
  if (typeof data.token === 'string' && data.type === 'workspace.invited') {
    router.push({ pathname: '/invite/[token]', params: { token: data.token } });
  } else if (typeof data.boardId === 'string' && typeof data.cardId === 'string') {
    router.push({
      pathname: '/board/[id]/card/[cardId]',
      params: { id: data.boardId, cardId: data.cardId },
    });
  }
}

let started = false;

/** Call once at app start: registers after login, and handles taps on notifications. */
export function startPush() {
  if (started || Platform.OS === 'web') return;
  started = true;

  if (useSession.getState().status === 'signedIn') void registerForPush();
  useSession.subscribe((state, prev) => {
    if (state.status === 'signedIn' && prev.status !== 'signedIn') void registerForPush();
  });

  Notifications.addNotificationResponseReceivedListener((response) =>
    openFromPush(response.notification.request.content.data),
  );
  // The app was opened by tapping a notification while it was closed.
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) openFromPush(response.notification.request.content.data);
  });
}
