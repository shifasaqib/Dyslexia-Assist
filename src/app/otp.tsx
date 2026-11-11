import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { isNoInternet, isTooManyRequests, supabase } from '../lib/supabase';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'Enter OTP Code';
const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;
const LINK_BLUE = '#1E6FB8';
const EMPTY_DOT = '#C9D3DB';
const ERROR = '#D93025';
const DELETE_BG = '#FDECEF';
const CHECK_BG = '#E3F7EC';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'delete', '0', 'check'];

export default function Otp() {
  const router = useRouter();
  const { email, sent } = useLocalSearchParams<{ email: string; sent?: string }>();

  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');

  // When a new code was sent from the "Verification Failed" screen,
  // clear the boxes and start the 60 second timer again.
  useEffect(() => {
    if (sent) {
      setCode('');
      setSeconds(RESEND_SECONDS);
    }
  }, [sent]);

  // Count down once per second until 0.
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const pressKey = (key: string) => {
    setMessage('');
    if (key === 'delete') {
      setCode(code.slice(0, -1));
    } else if (key === 'check') {
      handleVerify();
    } else if (code.length < CODE_LENGTH) {
      setCode(code + key);
    }
  };

  const handleVerify = async () => {
    if (loading) return;
    if (code.length < CODE_LENGTH) {
      setMessage(`Please type all ${CODE_LENGTH} numbers.`);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    setLoading(false);

    if (error) {
      if (isNoInternet(error)) {
        Alert.alert('No internet', 'Please check your internet connection and try again.');
        return;
      }
      setCode('');
      router.push({ pathname: '/verify-failed', params: { email } });
      return;
    }

    router.replace('/verified');
  };

  const handleResend = async () => {
    if (seconds > 0 || resending) return;

    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);

    if (error) {
      if (isTooManyRequests(error)) {
        Alert.alert('Please wait', 'Please wait a moment before asking for a new code.');
      } else if (isNoInternet(error)) {
        Alert.alert('No internet', 'Please check your internet connection and try again.');
      } else {
        Alert.alert('Something went wrong', 'We could not send a new code. Please try again.');
      }
      return;
    }

    setCode('');
    setSeconds(RESEND_SECONDS);
    Alert.alert('New code sent!', 'Please check your email.');
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
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={26} color={colors.brown} />
            </Pressable>
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

          <Text style={styles.subtitle}>
            Check your email • We sent a {CODE_LENGTH}-digit code to
          </Text>
          <Text style={styles.email} numberOfLines={1} adjustsFontSizeToFit>
            {email}
          </Text>

          <View style={styles.boxes}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <View key={i} style={styles.box}>
                <View style={i < code.length ? styles.dotFilled : styles.dotEmpty} />
              </View>
            ))}
          </View>

          {message !== '' && <Text style={styles.errorText}>{message}</Text>}

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn't get code? </Text>
            <Pressable onPress={handleResend} disabled={seconds > 0 || resending}>
              <Text style={[styles.resendLink, seconds > 0 && styles.resendWaiting]}>
                {resending ? 'Sending…' : seconds > 0 ? `Resend (${seconds}s)` : 'Resend'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.keypad}>
            {KEYS.map((key) => (
              <Pressable
                key={key}
                style={({ pressed }) => [
                  styles.key,
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
                  <Text style={styles.keyText}>{key}</Text>
                )}
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              loading && styles.buttonBusy,
              pressed && styles.pressed,
            ]}
            onPress={handleVerify}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'CHECKING…' : 'VERIFY NOW'}</Text>
            {!loading && <Ionicons name="arrow-forward" size={22} color={colors.brown} />}
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
  titleWrap: { alignSelf: 'center', marginTop: 10 },
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
  email: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.navy,
    textAlign: 'center',
    marginTop: 2,
  },
  boxes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  box: {
    width: 44,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 3,
    borderBottomColor: colors.whiteShadow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFilled: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.yellow,
  },
  dotEmpty: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: EMPTY_DOT,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: ERROR,
    textAlign: 'center',
    marginTop: 8,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  resendText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.navy,
  },
  resendLink: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: LINK_BLUE,
    textDecorationLine: 'underline',
  },
  resendWaiting: { color: colors.muted },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 14,
    rowGap: 12,
    alignSelf: 'center',
    width: 3 * 64 + 2 * 14,
    marginTop: 18,
  },
  key: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    borderBottomWidth: 4,
    borderBottomColor: colors.whiteShadow,
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
    marginTop: 22,
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.brown,
  },
});
