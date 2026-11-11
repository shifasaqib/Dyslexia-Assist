import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { logOut } from '../lib/auth';
import { supabase } from '../lib/supabase';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];

// If the name already starts with "Dr." or "Dr ", remove it,
// so the greeting does not say "Dr. Dr. Ali".
const withoutDr = (fullName: string) => fullName.replace(/^(dr\.\s*|dr\s+)/i, '');

export default function DoctorHome() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [leaving, setLeaving] = useState(false);

  // Read the doctor's name from the doctors table.
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user.id;
      if (!userId) {
        router.replace('/welcome');
        return;
      }
      const { data } = await supabase
        .from('doctors')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();
      if (data?.full_name) setName(withoutDr(data.full_name));
    })();
  }, []);

  const handleLogOut = async () => {
    if (leaving) return;
    setLeaving(true);
    await logOut();
    router.replace('/welcome');
  };

  const title = name ? `Hi, Dr. ${name}!` : 'Hi, Doctor!';

  return (
    <LinearGradient
      colors={[colors.skyTop, colors.skyMid, colors.mint]}
      locations={[0, 0.5, 1]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </View>

          <View style={styles.titleWrap}>
            {OUTLINE.map(([x, y], i) => (
              <Text
                key={i}
                style={[styles.title, styles.titleOutline, { left: x, right: -x, top: y }]}
              >
                {title}
              </Text>
            ))}
            <Text style={styles.title}>{title}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name="medkit" size={38} color={colors.doctorGreen} />
            </View>
            <Text style={styles.cardText}>Your Doctor Dashboard is coming soon.</Text>
          </View>

          <View style={styles.spacer} />

          <Pressable
            style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
            onPress={handleLogOut}
            disabled={leaving}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.navy} />
            <Text style={styles.logoutText}>{leaving ? 'Please wait…' : 'Log out'}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  logo: { width: 100, height: 82 },
  titleWrap: { alignSelf: 'center', marginTop: 24, marginBottom: 28 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  card: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  cardIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.circle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardText: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.navy,
    textAlign: 'center',
  },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  spacer: { flex: 1, minHeight: 32 },
  logout: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  logoutText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.navy,
  },
});
