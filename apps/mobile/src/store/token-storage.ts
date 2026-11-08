import * as SecureStore from 'expo-secure-store';

import type { TokenPair } from '@/api/types';

// Tokens live only in SecureStore (Keychain / Keystore), never AsyncStorage.
const ACCESS_KEY = 'taskkit.accessToken';
const REFRESH_KEY = 'taskkit.refreshToken';

export async function loadTokens(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  // The refresh token is what keeps a session alive; an access token alone is useless.
  if (!refreshToken) return null;
  return { accessToken: accessToken ?? '', refreshToken };
}

export async function saveTokens(tokens: TokenPair) {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}
