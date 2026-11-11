import 'react-native-url-polyfill/auto';
import { AuthError, createClient, isAuthRetryableFetchError, processLock } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

// Public values only. They come from the .env file (EXPO_PUBLIC_ prefix).
// Never put a secret / service_role key here.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase settings are missing. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart with "npx expo start --clear".'
  );
}

// SecureStore can only hold small values (about 2 KB each), but a login
// session is bigger. So we save it in small pieces ("chunks").
const CHUNK_SIZE = 1800;

async function removeChunks(key: string) {
  const count = Number(await SecureStore.getItemAsync(`${key}.count`)) || 0;
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
  await SecureStore.deleteItemAsync(`${key}.count`);
}

const secureStorage = {
  async getItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.count`)) || 0;
    if (count === 0) return null;

    let value = '';
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null;
      value += part;
    }
    return value;
  },

  async setItem(key: string, value: string) {
    await removeChunks(key);
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}.count`, String(count));
  },

  async removeItem(key: string) {
    await removeChunks(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// Keep the login fresh only while the app is open on the screen.
if (AppState.currentState === 'active') {
  supabase.auth.startAutoRefresh();
}
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

// Small helpers so every screen can show the same kind messages.
export function isTooManyRequests(error: AuthError) {
  return (
    error.status === 429 ||
    error.code === 'over_email_send_rate_limit' ||
    error.code === 'over_request_rate_limit'
  );
}

// True only when the phone could not reach Supabase at all (status 0).
// Server problems (500, 502 ...) are NOT "no internet".
export function isNoInternet(error: AuthError) {
  return isAuthRetryableFetchError(error) && !error.status;
}

// True when Supabase answered, but had a problem on its side
// (for example the email could not be sent).
export function isServerError(error: AuthError) {
  return (error.status ?? 0) >= 500;
}
