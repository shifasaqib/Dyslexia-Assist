import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';

// IMAGE PATHS: change these lines if you rename or move the images
const LOGO = require('../../assets/images/logo.png');
const FISH = require('../../assets/images/fish.png');

const CIRCLE_COLOR = '#8FD4F7';
const TITLE_BLUE = '#1E88D9';
const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'Listen & Follow';

export default function OnboardingTwo() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={[colors.skyTop, colors.skyMid, colors.mint]}
      locations={[0, 0.5, 1]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.topRow}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Pressable
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            onPress={() => router.replace('/welcome')}
          >
            <Text style={styles.skipText}>SKIP</Text>
          </Pressable>
        </View>

        <View style={styles.center}>
          <View style={[styles.circle, { backgroundColor: CIRCLE_COLOR }]}>
            <Image source={FISH} style={styles.mascot} resizeMode="contain" />
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

          <Text style={styles.subtitle}>Words light up as they are read.</Text>

          <View style={styles.dots}>
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>
        </View>

        <View style={styles.bottom}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => router.push('/onboarding3')}
          >
            <Text style={styles.buttonText}>NEXT</Text>
            <Ionicons name="arrow-forward" size={22} color={colors.navy} />
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  logo: { width: 100, height: 82 },
  skip: {
    backgroundColor: '#FFC933',
    borderWidth: 2,
    borderColor: colors.yellow,
    borderBottomWidth: 4,
    borderBottomColor: colors.orangeDark,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  skipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.brown,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 4,
    borderStyle: 'dashed',
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  mascot: { width: 210, height: 180 },
  titleWrap: { alignSelf: 'center' },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: TITLE_BLUE,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  subtitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  dots: { flexDirection: 'row', gap: 6, marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white },
  dotActive: { width: 22, backgroundColor: colors.orange },
  bottom: { paddingBottom: 40 },
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
    color: colors.navy,
  },
});