import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { getHomeRoute, type HomeRoute } from '../lib/auth';
import { supabase } from '../lib/supabase';

// IMAGE PATHS: change these lines if you rename or move the images
const LOGO = require('../../assets/images/logo.png');
const MONKEY = require('../../assets/images/monkey.png');

const ASSIST_BLUE = '#1E88D9';
const WORD_ONE = 'Dyslexia';
const FULL_TEXT = 'Dyslexia Assist';
const START_DELAY = 500; // wait before typing starts
const LETTER_DELAY = 140; // time between each letter
const WORD_PAUSE = 350; // small pause between the two words

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];

// Is someone already logged in on this phone? If yes, which home screen?
// Returns null when there is no (working) saved login.
async function findSavedHome(): Promise<HomeRoute | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;

    const route = await getHomeRoute(data.session.user.id);
    if (!route) {
      // Old or broken login: clear it from this phone only.
      await supabase.auth.signOut({ scope: 'local' });
    }
    return route;
  } catch {
    return null;
  }
}

export default function Splash() {
  const router = useRouter();
  const [typed, setTyped] = useState(0);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Start the saved-login check quietly while the animation plays.
  const savedHome = useRef<Promise<HomeRoute | null> | null>(null);
  useEffect(() => {
    savedHome.current = findSavedHome();
  }, []);

  const handleContinue = async () => {
    if (leaving) return;
    setLeaving(true);
    // Waits for the check if it is still running, so a fast tap is never wrong.
    const route = await (savedHome.current ?? findSavedHome());
    router.replace(route ?? '/onboarding1');
  };

  const logoAnim = useRef(new Animated.Value(0)).current;
  const restAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Typewriter: show one more letter each time
    if (typed < FULL_TEXT.length) {
      let delay = LETTER_DELAY;
      if (typed === 0) delay = START_DELAY;
      else if (FULL_TEXT[typed] === ' ') delay = WORD_PAUSE;

      const timer = setTimeout(() => setTyped(typed + 1), delay);
      return () => clearTimeout(timer);
    }

    // Typing done: logo comes up, then the rest fades in
    Animated.sequence([
      Animated.timing(logoAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(restAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => setReady(true));
  }, [typed]);

  // Hidden letters stay in place (transparent) so the text never jumps around
  const renderLetters = (outline: boolean) =>
    FULL_TEXT.split('').map((ch, i) => {
      const shown = i < typed;
      const baseColor = outline
        ? colors.white
        : i < WORD_ONE.length
        ? colors.navy
        : ASSIST_BLUE;
      return (
        <Text key={i} style={{ color: shown ? baseColor : 'transparent' }}>
          {ch}
        </Text>
      );
    });

  const logoStyle = {
    opacity: logoAnim,
    transform: [
      { translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
    ],
  };

  const fadeStyle = {
    opacity: restAnim,
    transform: [
      { translateY: restAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) },
    ],
  };

  return (
    <LinearGradient
      colors={[colors.skyTop, colors.skyMid, colors.mint]}
      locations={[0, 0.5, 1]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <Animated.Image source={LOGO} style={[styles.logo, logoStyle]} resizeMode="contain" />

          <View style={styles.titleWrap}>
            {OUTLINE.map(([x, y], i) => (
              <Text
                key={i}
                style={[styles.title, styles.titleOutline, { left: x, right: -x, top: y }]}
              >
                {renderLetters(true)}
              </Text>
            ))}
            <Text style={styles.title}>{renderLetters(false)}</Text>
          </View>

          <Animated.View style={fadeStyle}>
            <Text style={styles.subtitle}>Your friendly reading companion</Text>
          </Animated.View>

          <Animated.View
            style={[styles.buttonWrap, fadeStyle]}
            pointerEvents={ready ? 'auto' : 'none'}
          >
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              onPress={handleContinue}
              disabled={leaving}
            >
              <Text style={styles.buttonText}>CONTINUE</Text>
              <Ionicons name="arrow-forward" size={22} color={colors.brown} />
            </Pressable>
          </Animated.View>
        </View>

        <Animated.View style={[styles.monkeyWrap, fadeStyle]}>
          <Image source={MONKEY} style={styles.monkey} resizeMode="contain" />
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
  top: { alignItems: 'center', marginTop: 24 },
  logo: { width: 120, height: 100, marginBottom: 14 },
  titleWrap: { alignSelf: 'center' },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute' },
  subtitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.navy,
    textAlign: 'center',
    marginTop: 4,
  },
  buttonWrap: { alignSelf: 'stretch', marginTop: 24 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    borderRadius: 32,
    backgroundColor: colors.orange,
    borderBottomWidth: 6,
    borderBottomColor: colors.orangeDark,
  },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.brown,
  },
  monkeyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  monkey: { width: 230, height: 270 },
});