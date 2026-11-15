import { clearChosenChild } from './child';
import { supabase } from './supabase';

export type HomeRoute =
  | '/parent-home'
  | '/doctor-home'
  | '/set-pin'
  | '/child-name'
  | '/child-select';

// Finds the right first screen for a logged-in user.
// The role comes from the database (doctors / parents table), not from the email.
// Returns null when the user is in neither table.
// Throws when the check itself fails (for example no internet).
export async function getHomeRoute(userId: string): Promise<HomeRoute | null> {
  const doctor = await supabase.from('doctors').select('id').eq('id', userId).maybeSingle();
  if (doctor.error) throw doctor.error;
  if (doctor.data) return '/doctor-home';

  const parent = await supabase.from('parents').select('id').eq('id', userId).maybeSingle();
  if (parent.error) throw parent.error;
  if (parent.data) return getParentRoute();

  return null;
}

// Parent order: no PIN -> Create PIN, no child -> child setup, else -> Who's Reading?
// The app never reads the PIN hash. It only asks the database "is there a PIN?".
export async function getParentRoute(): Promise<HomeRoute> {
  const pin = await supabase.rpc('has_parent_pin');
  if (pin.error) throw pin.error;
  if (!pin.data) return '/set-pin';

  // RLS makes sure only this parent's children are counted.
  const kids = await supabase.from('children').select('id', { count: 'exact', head: true });
  if (kids.error) throw kids.error;
  if (!kids.count) return '/child-name';

  return '/child-select';
}

// Logs out and forgets the chosen child.
// If the phone is offline, still clears the login on this phone.
export async function logOut() {
  await clearChosenChild();
  const { error } = await supabase.auth.signOut();
  if (error) {
    await supabase.auth.signOut({ scope: 'local' });
  }
}
