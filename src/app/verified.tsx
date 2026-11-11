import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { getHomeRoute } from '../lib/auth';
import { supabase } from '../lib/supabase';

// IMAGE PATHS: change these lines if you rename or move the images
const LOGO = require('../../assets/images/logo.png');
const PENGUIN = require('../../assets/images/penguin.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'You are Verified!';
const GREEN = '#22B85A';
const GREEN_DARK = '#178A42';
const CIRCLE_COLOR = '#A8EED2';

export default function Verified() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleContinue = async () => {
    if (busy) return;
    setBusy(true);

    try {
      // After the code is verified, the user is already logged in.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        Alert.alert('Please log in', 'Please log in to continue.', [
          { text: 'OK', onPress: () => router.replace('/login') },
        ]);
        return;
      }

      // Role check: doctor or parent? (comes from the database)
      let route;
      try {
        route = await getHomeRoute(data.session.user.id);
      } catch {
        Alert.alert('No internet', 'Could not connect. Please check your internet and try again.');
        return;
      }

      if (!route) {
        await supabase.auth.signOut({ scope: 'local' });
        Alert.alert('Account not found', 'Account not found. Please sign up.');
        return;
      }

      // replace: Back will not return to the OTP screens
      router.replace(route);
    } finally {
      setBusy(false);
    }
  };

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
            <Pressable
              style={({ pressed }) => [styles.bulb, pressed && styles.pressed]}
              onPress={() => {
                // About page will be connected later
              }}
            >
              <Ionicons name="bulb" size={26} color={colors.brown} />
            </Pressable>
          </View>

          <View style={styles.center}>
            <View style={styles.badge}>
              <Ionicons name="checkmark" size={40} color={colors.white} />
            </View>

            <View style={styles.circle}>
              <Image source={PENGUIN} style={styles.penguin} resizeMode="contain" />
            </View>

            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>
                {'“Yay! You’re all set to start your journey! ;)”'}
              </Text>
            </View>

            <View style={styles.titleWrap}>
              {OUTLINE.map(([x, y], i) => (
                <Text
                  key={i}
                  style={[styles.title, styles.titleOutline, { left: x, right: -x, top: y }]}
                >
                  {TITLE}
                </Text>
              ))}
              <Text style={styles.title}>{TITLE}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, busy && styles.buttonBusy, pressed && styles.pressed]}
            onPress={handleContinue}
            disabled={busy}
          >
            <Text style={styles.buttonText}>{busy ? 'PLEASE WAIT…' : 'CONTINUE'}</Text>
            {!busy && <Ionicons name="arrow-forward" size={22} color={colors.white} />}
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
  bulb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFC933',
    borderWidth: 2,
    borderColor: colors.yellow,
    borderBottomWidth: 5,
    borderBottomColor: colors.orangeDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: GREEN,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  circle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: CIRCLE_COLOR,
    borderWidth: 4,
    borderStyle: 'dashed',
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  penguin: { width: 160, height: 185 },
  bubble: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 18,
  },
  bubbleText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.navy,
    textAlign: 'center',
  },
  titleWrap: { alignSelf: 'center', marginTop: 16 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.doctorGreen,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    borderRadius: 32,
    backgroundColor: GREEN,
    borderBottomWidth: 6,
    borderBottomColor: GREEN_DARK,
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.white,
  },
});
