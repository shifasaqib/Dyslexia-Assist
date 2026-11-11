import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { getHomeRoute } from '../lib/auth';
import { isNoInternet, isServerError, isTooManyRequests, supabase } from '../lib/supabase';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'Welcome Back!';
const INPUT_BG = '#EEF6FF';
const PLACEHOLDER = '#8A9AAA';
const ERROR = '#D93025';
const CARD_BORDER = '#FFE08A';
const LINK_BLUE = '#1E6FB8';

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      e.email = 'Please enter a valid email address.';
    }
    if (password.length === 0) {
      e.password = 'Please enter your password.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (loading || !validate()) return;

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        if (isTooManyRequests(error)) {
          Alert.alert('Please wait', 'Too many tries. Please wait a few minutes and try again.');
        } else if (isNoInternet(error)) {
          Alert.alert('No internet', 'Could not connect. Please check your internet and try again.');
        } else if (error.code === 'email_not_confirmed') {
          askToVerify(cleanEmail);
        } else if (error.code === 'invalid_credentials' || error.status === 400) {
          // Same message for wrong email and wrong password (do not say which one).
          Alert.alert('Try again', 'Incorrect email or password.');
        } else if (isServerError(error)) {
          Alert.alert('Please try later', 'Something went wrong on our side. Please try again in a few minutes.');
        } else {
          Alert.alert('Something went wrong', 'Please try again.');
        }
        return;
      }

      // Role check: doctor or parent? (comes from the database)
      let route;
      try {
        route = await getHomeRoute(data.user.id);
      } catch {
        await supabase.auth.signOut({ scope: 'local' });
        Alert.alert('No internet', 'Could not connect. Please check your internet and try again.');
        return;
      }

      if (!route) {
        await supabase.auth.signOut({ scope: 'local' });
        Alert.alert('Account not found', 'Account not found. Please sign up.');
        return;
      }

      // replace: Back will not return to Login
      router.replace(route);
    } finally {
      setLoading(false);
    }
  };

  // Email is not verified yet: offer to send a new code and open the OTP screen.
  const askToVerify = (cleanEmail: string) => {
    Alert.alert('Not verified yet', 'Please verify your email first.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send Code',
        onPress: async () => {
          const { error } = await supabase.auth.resend({ type: 'signup', email: cleanEmail });
          if (error) {
            if (isTooManyRequests(error)) {
              Alert.alert('Please wait', 'Please wait a moment before asking for a new code.');
            } else if (isNoInternet(error)) {
              Alert.alert('No internet', 'Please check your internet connection and try again.');
            } else if (isServerError(error)) {
              Alert.alert('Please try later', 'We could not send the email right now. Please try again in a few minutes.');
            } else {
              Alert.alert('Something went wrong', 'We could not send a new code. Please try again.');
            }
            return;
          }
          router.push({ pathname: '/otp', params: { email: cleanEmail } });
        },
      },
    ]);
  };

  const handleForgot = () => {
    Alert.alert('Coming soon', 'Password reset is coming soon.');
  };

  return (
    <LinearGradient
      colors={[colors.skyTop, colors.skyMid, colors.mint]}
      locations={[0, 0.5, 1]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
                  numberOfLines={1}
                  style={[styles.title, styles.titleOutline, { left: x, right: -x, top: y }]}
                >
                  {TITLE}
                </Text>
              ))}
              <Text numberOfLines={1} style={styles.title}>
                {TITLE}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={[styles.label, styles.firstLabel]}>EMAIL</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

              <Text style={styles.label}>PASSWORD</Text>
              <View style={[styles.inputRow, errors.password && styles.inputError]}>
                <TextInput
                  style={styles.rowInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  placeholderTextColor={PLACEHOLDER}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable style={styles.eye} onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={PLACEHOLDER}
                  />
                </Pressable>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                loading && styles.buttonBusy,
                pressed && !loading && styles.pressed,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'PLEASE WAIT…' : 'LOGIN'}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.forgot, pressed && styles.pressed]}
              onPress={handleForgot}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.footer, pressed && styles.pressed]}
              onPress={() => router.replace('/role')}
            >
              <Text style={styles.footerText}>
                New here? <Text style={styles.footerLink}>Sign up</Text>
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
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
  titleWrap: { alignSelf: 'center', marginTop: 24, marginBottom: 20 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: CARD_BORDER,
    borderRadius: 22,
    padding: 18,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.navy,
    marginTop: 14,
    marginBottom: 6,
  },
  firstLabel: { marginTop: 0 },
  input: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.navy,
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: INPUT_BG,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: INPUT_BG,
  },
  rowInput: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.navy,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  eye: { paddingHorizontal: 12, paddingVertical: 10 },
  inputError: { borderColor: ERROR },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: ERROR,
    marginTop: 4,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    borderRadius: 32,
    backgroundColor: colors.orange,
    borderBottomWidth: 6,
    borderBottomColor: colors.orangeDark,
    marginTop: 26,
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    letterSpacing: 1,
    color: colors.brown,
  },
  buttonBusy: { opacity: 0.7 },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  forgot: {
    alignSelf: 'center',
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
  },
  forgotText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.navy,
    textDecorationLine: 'underline',
  },
  footer: {
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 40,
  },
  footerText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.navy,
  },
  footerLink: {
    fontFamily: fonts.bold,
    color: LINK_BLUE,
    textDecorationLine: 'underline',
  },
});