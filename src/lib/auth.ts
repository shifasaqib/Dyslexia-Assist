import { supabase } from './supabase';

export type HomeRoute = '/parent-home' | '/doctor-home';

// Finds the right home screen for a logged-in user.
// The role comes from the database (doctors / parents table), not from the email.
// Returns null when the user is in neither table.
// Throws when the check itself fails (for example no internet).
export async function getHomeRoute(userId: string): Promise<HomeRoute | null> {
  const doctor = await supabase.from('doctors').select('id').eq('id', userId).maybeSingle();
  if (doctor.error) throw doctor.error;
  if (doctor.data) return '/doctor-home';

  const parent = await supabase.from('parents').select('id').eq('id', userId).maybeSingle();
  if (parent.error) throw parent.error;
  if (parent.data) return '/parent-home';

  return null;
}

// Logs out. If the phone is offline, still clears the login on this phone.
export async function logOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    await supabase.auth.signOut({ scope: 'local' });
  }
}
