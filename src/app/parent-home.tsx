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

export default function ParentHome() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [leaving, setLeaving] = useState(false);

  // Read the parent's name from the parents table.
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user.id;
      if (!userId) {
        router.replace('/welcome');
        return;
      }
      const { data } = await supabase
        .from('parents')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();
      if (data?.full_name) setName(data.full_name);
    })();
  }, []);

  const handleLogOut = async () => {
    if (leaving) return;
    setLeaving(true);
    await logOut();
    router.replace('/welcome');
  };

  const title = name ? `Hi, ${name}!` : 'Hi there!';

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

          <Text style={styles.subtitle}>What would you like to do today?</Text>

          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => router.push('/scan')}
          >
            <View style={styles.cardIcon}>
              <Ionicons name="book" size={40} color={colors.orangeDark} />
            </View>
            <Text style={styles.cardTitle}>Read a Book</Text>
            <Text style={styles.cardText}>Take a photo or pick a PDF</Text>
          </Pressable>

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
  titleWrap: { alignSelf: 'center', marginTop: 24 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  subtitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.navy,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  card: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 32,
    backgroundColor: colors.orange,
    borderBottomWidth: 6,
    borderBottomColor: colors.orangeDark,
  },
  cardIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.brown,
  },
  cardText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.brown,
    marginTop: 4,
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
