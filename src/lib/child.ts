import * as SecureStore from 'expo-secure-store';

// IMAGE PATHS: change these lines if you rename or move the images
const RABBIT = require('../../assets/images/rabbit.png');
const FISH = require('../../assets/images/fish.png');
const MONKEY = require('../../assets/images/monkey.png');
const PENGUIN = require('../../assets/images/penguin.png');

// The 4 buddies a child can pick. "key" is what we save in children.avatar
// (the database only allows these 4 words).
export type AvatarKey = 'rabbit' | 'fish' | 'monkey' | 'penguin';

export const AVATARS: { key: AvatarKey; label: string; image: number; circle: string }[] = [
  { key: 'rabbit', label: 'Rabbit', image: RABBIT, circle: '#F9D3DC' },
  { key: 'fish', label: 'Fish', image: FISH, circle: '#CDEBFA' },
  { key: 'monkey', label: 'Monkey', image: MONKEY, circle: '#F5E6A8' },
  { key: 'penguin', label: 'Penguin', image: PENGUIN, circle: '#C9F2DF' },
];

export function avatarFor(key?: string | null) {
  return AVATARS.find((a) => a.key === key) ?? AVATARS[2];
}

// Only these fields are stored for a child (security rule 22).
export type Child = { id: string; name: string; age: number | null; avatar: string | null };

// Child name: same rule as sign up (English letters, spaces and . ' -)
export const NAME_RULE = /^[A-Za-z][A-Za-z .'-]*$/;
export const cleanName = (text: string) => text.trim().replace(/\s+/g, ' ');

export const MIN_AGE = 3;
export const MAX_AGE = 18;

// The chosen child: kept in app memory and in SecureStore (only the id).
const CHOSEN_KEY = 'chosen_child_id';
let chosenChildId: string | null = null;

export async function saveChosenChild(id: string) {
  chosenChildId = id;
  await SecureStore.setItemAsync(CHOSEN_KEY, id);
}

export async function getChosenChild() {
  if (chosenChildId) return chosenChildId;
  chosenChildId = await SecureStore.getItemAsync(CHOSEN_KEY);
  return chosenChildId;
}

export async function clearChosenChild() {
  chosenChildId = null;
  await SecureStore.deleteItemAsync(CHOSEN_KEY);
}
