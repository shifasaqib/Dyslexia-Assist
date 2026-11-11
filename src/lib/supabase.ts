import 'react-native-url-polyfill/auto';
<<<<<<< HEAD
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

export function isNoInternet(error: AuthError) {
  return isAuthRetryableFetchError(error);
}
=======
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

// Public values only, read from .env (never put secret keys here)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Supabase URL or key is missing. Check the .env file and restart with --clear.');
}

// Secure Store likes small items, so the session is saved in small pieces
const PIECE_SIZE = 1800;

const removeItem = async (key: string) => {
  const count = await SecureStore.getItemAsync(`${key}_count`);
  for (let i = 0; i < Number(count ?? 0); i++) {
    await SecureStore.deleteItemAsync(`${key}_${i}`);
  }
  await SecureStore.deleteItemAsync(`${key}_count`);
};

const getItem = async (key: string) => {
  const count = await SecureStore.getItemAsync(`${key}_count`);
  if (!count) return null;
  let value = '';
  for (let i = 0; i < Number(count); i++) {
    const piece = await SecureStore.getItemAsync(`${key}_${i}`);
    if (piece === null) return null;
    value += piece;
  }
  return value;
};

const setItem = async (key: string, value: string) => {
  await removeItem(key);
  const count = Math.ceil(value.length / PIECE_SIZE);
  for (let i = 0; i < count; i++) {
    await SecureStore.setItemAsync(`${key}_${i}`, value.slice(i * PIECE_SIZE, (i + 1) * PIECE_SIZE));
  }
  await SecureStore.setItemAsync(`${key}_count`, String(count));
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: { getItem, setItem, removeItem },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh the session only while the app is open on screen
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
>>>>>>> origin/marium-work
