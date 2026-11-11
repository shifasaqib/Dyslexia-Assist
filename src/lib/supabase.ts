import 'react-native-url-polyfill/auto';
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
