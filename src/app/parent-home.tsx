import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { logOut } from '../lib/auth';
import { avatarFor, clearChosenChild, getChosenChild } from '../lib/child';
import { supabase } from '../lib/supabase';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];

export default function ParentHome() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Read the chosen child's name and buddy from the children table.
  // If no child is chosen (or it was removed), open Who's Reading?.
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) {
        router.replace('/welcome');
        return;
      }
      const childId = await getChosenChild();
      if (!childId) {
        router.replace('/child-select');
        return;
      }
      const { data, error } = await supabase
        .from('children')
        .select('name, avatar')
        .eq('id', childId)
        .maybeSingle();
      if (!error && !data) {
        await clearChosenChild();
        router.replace('/child-select');
        return;
      }
      if (data) {
        setName(data.name);
        setAvatar(data.avatar);
      }
    })();
  }, []);

  const handleLogOut = async () => {
    if (leaving) return;
    setLeaving(true);
    await logOut();
    router.replace('/welcome');
  };

  const title = name ? `Hi, ${name}!` : 'Hi there!';
  const buddy = avatarFor(avatar);

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

          {avatar && (
            <View style={[styles.buddyCircle, { backgroundColor: buddy.circle }]}>
              <Image source={buddy.image} style={styles.buddy} resizeMode="contain" />
            </View>
          )}

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

          <View style={styles.links}>
            <Pressable
              style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
              onPress={() => router.replace('/child-select')}
              disabled={leaving}
            >
              <Ionicons name="people" size={18} color={colors.navy} />
              <Text style={styles.logoutText}>Switch Child</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
              onPress={handleLogOut}
              disabled={leaving}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.navy} />
              <Text style={styles.logoutText}>{leaving ? 'Please wait…' : 'Log out'}</Text>
            </Pressable>
          </View>
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
  buddyCircle: {
    alignSelf: 'center',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buddy: { width: 86, height: 92 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  titleWrap: { alignSelf: 'center', marginTop: 16 },
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
