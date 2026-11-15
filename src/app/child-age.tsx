import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { MAX_AGE, MIN_AGE } from '../lib/child';

// IMAGE PATHS: change these lines if you rename or move the images
const LOGO = require('../../assets/images/logo.png');
const MONKEY = require('../../assets/images/monkey.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'How old are you?';
const CIRCLE_COLOR = '#E2D36C';
const MAX_DIGITS = 2;
const ERROR = '#D93025';
const DELETE_BG = '#FDECEF';
const CHECK_BG = '#E3F7EC';

// Colorful number keys (only used on the PIN and age screens)
const KEY_COLORS = [
  { bg: '#F45B7A', text: '#FFFFFF' },
  { bg: '#FFB020', text: '#5C2E00' },
  { bg: '#2BC48A', text: '#FFFFFF' },
  { bg: '#1EA0E6', text: '#FFFFFF' },
  { bg: '#A47CF3', text: '#FFFFFF' },
  { bg: '#F06CB4', text: '#FFFFFF' },
  { bg: '#2CD3B5', text: '#0B2A4A' },
  { bg: '#FF8A4C', text: '#FFFFFF' },
];
const keyColor = (key: string) =>
  KEY_COLORS[(key === '0' ? 9 : Number(key) - 1) % KEY_COLORS.length];

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'delete', '0', 'check'];

export default function ChildAge() {
  const router = useRouter();
  const { name, from } = useLocalSearchParams<{ name: string; from?: string }>();

  const [age, setAge] = useState('');
  const [error, setError] = useState('');

  const pressKey = (key: string) => {
    setError('');
    if (key === 'delete') {
      setAge(age.slice(0, -1));
    } else if (key === 'check') {
      handleNext();
    } else if (age.length < MAX_DIGITS) {
      setAge(age + key);
    }
  };

  const handleNext = () => {
    if (age === '') {
      setError('Please enter your age.');
      return;
    }
    const value = Number(age);
    if (value < MIN_AGE || value > MAX_AGE) {
      setError(`Please enter an age from ${MIN_AGE} to ${MAX_AGE}.`);
      return;
    }
    router.push({
      pathname: '/child-avatar',
      params: { name, age: String(value), from: from ?? '' },
    });
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
            <View style={styles.topRight}>
              <View style={styles.stepPill}>
                <Text style={styles.stepText}>STEP 2 OF 3</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.back, pressed && styles.pressed]}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={26} color={colors.brown} />
              </Pressable>
            </View>
          </View>

          <View style={styles.circle}>
            <Image source={MONKEY} style={styles.mascot} resizeMode="contain" />
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

          <View style={[styles.ageBox, error !== '' && styles.ageBoxError]}>
            <Text style={[styles.ageText, age === '' && styles.agePlaceholder]}>
              {age === '' ? '?' : age}
            </Text>
          </View>
          {error !== '' && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.keypad}>
            {KEYS.map((key) => {
              const isDigit = key !== 'delete' && key !== 'check';
              const tint = isDigit ? keyColor(key) : null;
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.key,
                    tint && { backgroundColor: tint.bg },
                    key === 'delete' && styles.deleteKey,
                    key === 'check' && styles.checkKey,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => pressKey(key)}
                >
                  {key === 'delete' ? (
                    <Ionicons name="backspace-outline" size={26} color={colors.title} />
                  ) : key === 'check' ? (
                    <Ionicons name="checkmark" size={28} color={colors.doctorGreen} />
                  ) : (
                    <Text style={[styles.keyText, tint && { color: tint.text }]}>{key}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={handleNext}
          >
            <Text style={styles.buttonText}>NEXT</Text>
            <Ionicons name="arrow-forward" size={22} color={colors.brown} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  logo: { width: 100, height: 82 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepPill: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.navy,
  },
  back: {
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
  circle: {
    alignSelf: 'center',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: CIRCLE_COLOR,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  mascot: { width: 86, height: 92 },
  titleWrap: { alignSelf: 'center', marginTop: 14 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  ageBox: {
    alignSelf: 'center',
    minWidth: 120,
    paddingHorizontal: 24,
    paddingVertical: 6,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.white,
    borderBottomWidth: 4,
    borderBottomColor: colors.whiteShadow,
    alignItems: 'center',
    marginTop: 14,
  },
  ageBoxError: { borderColor: ERROR, borderBottomColor: ERROR },
  ageText: {
    fontFamily: fonts.bold,
    fontSize: 40,
    color: colors.navy,
  },
  agePlaceholder: { color: colors.whiteShadow },
  errorText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: ERROR,
    textAlign: 'center',
    marginTop: 8,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 14,
    rowGap: 12,
    alignSelf: 'center',
    width: 3 * 64 + 2 * 14,
    marginTop: 16,
  },
  key: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteKey: { backgroundColor: DELETE_BG },
  checkKey: { backgroundColor: CHECK_BG },
  keyText: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.navy,
  },
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
    marginTop: 20,
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.brown,
  },
});
