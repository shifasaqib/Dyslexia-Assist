import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { getParentRoute, logOut } from '../lib/auth';
import { supabase } from '../lib/supabase';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const PIN_LENGTH = 4;
const ERROR = '#D93025';
const EMPTY_DOT = '#C9D3DB';
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

type Step = 'create' | 'confirm';

export default function SetPin() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('create');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const title = step === 'create' ? 'Create Parent PIN' : 'Confirm Parent PIN';
  const subtitle =
    step === 'create' ? 'This keeps Parent Zone just for you.' : 'Type the same PIN again.';

  // Back: from "Confirm" go back to "Create". From "Create" offer to log out,
  // because the screens before this one (sign up / login) are finished.
  const handleBack = () => {
    if (saving) return;
    if (step === 'confirm') {
      setStep('create');
      setFirstPin('');
      setPin('');
      setMessage('');
      return;
    }
    Alert.alert('Leave setup?', 'You will be logged out. You can log in again later.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logOut();
          router.replace('/welcome');
        },
      },
    ]);
  };

  // Android back button does the same as our back arrow
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  });

  const pressKey = (key: string) => {
    if (saving) return;
    setMessage('');
    if (key === 'delete') {
      setPin(pin.slice(0, -1));
    } else if (key === 'check') {
      handleContinue();
    } else if (pin.length < PIN_LENGTH) {
      setPin(pin + key);
    }
  };

  const handleContinue = async () => {
    if (saving) return;
    if (pin.length < PIN_LENGTH) {
      setMessage(`Please type all ${PIN_LENGTH} numbers.`);
      return;
    }

    if (step === 'create') {
      setFirstPin(pin);
      setPin('');
      setStep('confirm');
      return;
    }

    if (pin !== firstPin) {
      setFirstPin('');
      setPin('');
      setStep('create');
      setMessage("The PINs do not match. Let's try again.");
      return;
    }

    setSaving(true);
    try {
      // The PIN is hashed inside the database. The app never saves it.
      const { error } = await supabase.rpc('set_parent_pin', { pin });
      if (error && !error.message.includes('already set')) {
        setMessage('We could not save your PIN. Please check your internet and try again.');
        return;
      }

      const route = await getParentRoute();
      router.replace(route);
    } catch {
      setMessage('Could not connect. Please check your internet and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.skyTop, colors.skyMid, colors.mint]}
      locations={[0, 0.5, 1]}
      style={styles.gradient}
    >
      <Stack.Screen options={{ gestureEnabled: false }} />
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <Pressable
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
              onPress={handleBack}
            >
              <Ionicons name="arrow-back" size={26} color={colors.brown} />
            </Pressable>
          </View>

          <View style={styles.titleWrap}>
            {OUTLINE.map(([x, y], i) => (
              <Text
                key={i}
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.title, styles.titleOutline, { left: x, right: -x, top: y }]}
              >
                {title}
              </Text>
            ))}
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.title}>
              {title}
            </Text>
          </View>

          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.dots}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View key={i} style={i < pin.length ? styles.dotFilled : styles.dotEmpty} />
            ))}
          </View>

          {message !== '' && <Text style={styles.errorText}>{message}</Text>}

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

          <Text style={styles.note}>This PIN protects the Parent Zone from children.</Text>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              saving && styles.buttonBusy,
              pressed && !saving && styles.pressed,
            ]}
            onPress={handleContinue}
            disabled={saving}
          >
            <Text style={styles.buttonText}>{saving ? 'PLEASE WAIT…' : 'CONTINUE'}</Text>
            {!saving && <Ionicons name="arrow-forward" size={22} color={colors.brown} />}
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
  titleWrap: { alignSelf: 'stretch', marginTop: 20 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  subtitle: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.navy,
    textAlign: 'center',
    marginTop: 6,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 22,
  },
  dotFilled: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.yellow,
    borderWidth: 2,
    borderColor: colors.white,
  },
  dotEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: EMPTY_DOT,
  },
  errorText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: ERROR,
    textAlign: 'center',
    marginTop: 10,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 14,
    rowGap: 12,
    alignSelf: 'center',
    width: 3 * 68 + 2 * 14,
    marginTop: 22,
  },
  key: {
    width: 68,
    height: 68,
    borderRadius: 34,
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
    fontSize: 26,
    color: colors.navy,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 16,
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
    marginTop: 16,
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.brown,
  },
});
