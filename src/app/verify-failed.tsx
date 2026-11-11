import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { isNoInternet, isTooManyRequests, supabase } from '../lib/supabase';

// IMAGE PATHS: change these lines if you rename or move the images
const LOGO = require('../../assets/images/logo.png');
const PENGUIN = require('../../assets/images/penguin.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'Verification Failed!';
const CIRCLE_COLOR = '#F6D5DE';

export default function VerifyFailed() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (resending) return;

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

    Alert.alert('New code sent!', 'Please check your email.', [
      {
        text: 'OK',
        // Go back to the OTP screen and restart its 60 second timer.
        onPress: () =>
          router.dismissTo({ pathname: '/otp', params: { email, sent: String(Date.now()) } }),
      },
    ]);
  };

  const handleHelp = () => {
    Alert.alert(
      'Need help?',
      '• Check your Spam or Junk folder.\n' +
        '• Make sure your email is spelled correctly.\n' +
        '• The code works for 10 minutes only.\n' +
        '• Wait 60 seconds, then tap "Resend Code".'
    );
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
              <Ionicons name="close" size={40} color={colors.white} />
            </View>

            <View style={styles.circle}>
              <Image source={PENGUIN} style={styles.penguin} resizeMode="contain" />
            </View>

            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>
                {'“Oops! Let’s try that again. Don’t worry! :(”'}
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

            <Text style={styles.message}>
              Sorry, something went wrong. You are not verified.{'\n'}
              Please check the code or request a new one.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>TRY AGAIN</Text>
            <Ionicons name="refresh" size={22} color={colors.brown} />
          </Pressable>

          <View style={styles.links}>
            <Pressable
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              onPress={handleResend}
              disabled={resending}
            >
              <Ionicons name="paper-plane-outline" size={16} color={colors.navy} />
              <Text style={styles.linkText}>{resending ? 'Sending…' : 'Resend Code'}</Text>
            </Pressable>

            <Text style={styles.linkDot}>•</Text>

            <Pressable
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              onPress={handleHelp}
            >
              <Ionicons name="help-circle-outline" size={16} color={colors.navy} />
              <Text style={styles.linkText}>Need Help?</Text>
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
    backgroundColor: colors.title,
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
    borderWidth: 2,
    borderColor: colors.title,
    borderRadius: 16,
    paddingVertical: 10,
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
    fontSize: 28,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  message: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    lineHeight: 20,
    color: colors.navy,
    textAlign: 'center',
    marginTop: 8,
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
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.brown,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  linkText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.navy,
    textDecorationLine: 'underline',
  },
  linkDot: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.muted,
  },
});
