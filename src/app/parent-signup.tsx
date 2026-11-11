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
import { isNoInternet, isServerError, isTooManyRequests, supabase } from '../lib/supabase';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'Parent Sign Up';
const INPUT_BG = '#EEF6FF';
const PLACEHOLDER = '#8A9AAA';
const ERROR = '#D93025';
const CARD_BORDER = '#FFE08A';
const LINK_BLUE = '#1E6FB8';

// Names: English letters and spaces, plus . ' - (for "O'Neil", "Mary-Jane").
// Must start with a letter.
const NAME_RULE = /^[A-Za-z][A-Za-z .'-]*$/;
const cleanName = (text: string) => text.trim().replace(/\s+/g, ' ');

export default function ParentSignUp() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};

    const name = cleanName(fullName);
    if (name.length === 0) {
      e.fullName = 'Please enter your full name.';
    } else if (!NAME_RULE.test(name)) {
      e.fullName = 'Name can only have letters.';
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      e.email = 'Please enter a valid email address.';
    }
    // Same rule as Supabase: 8+ characters with a small letter,
    // a capital letter, a number and a symbol.
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
      e.password = 'Use 8 or more characters with a small letter, a capital letter, a number and a symbol.';
    }
    if (confirm.length === 0 || confirm !== password) {
      e.confirm = 'Passwords do not match.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignUp = async () => {
    if (loading || !validate()) return;

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { role: 'parent', full_name: cleanName(fullName) } },
    });
    setLoading(false);

    if (error) {
      if (isTooManyRequests(error)) {
        Alert.alert('Please wait', 'Too many tries. Please wait a moment and try again.');
      } else if (isNoInternet(error)) {
        Alert.alert('No internet', 'Please check your internet connection and try again.');
      } else if (isServerError(error)) {
        Alert.alert('Please try later', 'We could not send the email right now. Please try again in a few minutes.');
      } else if (error.code === 'weak_password') {
        setErrors({ password: 'This password is too weak. Please choose a stronger one.' });
      } else if (error.code === 'user_already_exists' || error.code === 'email_exists') {
        Alert.alert('Account found', 'This email already has an account. Please log in.');
      } else {
        Alert.alert('Something went wrong', 'We could not create your account. Please try again.');
      }
      return;
    }

    // Supabase gives no error for an email that is already confirmed.
    // Instead, the user comes back with an empty "identities" list.
    if (data.user?.identities?.length === 0) {
      Alert.alert('Account found', 'This email already has an account. Please log in.');
      return;
    }

    router.push({ pathname: '/otp', params: { email: cleanEmail } });
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
                  style={[styles.title, styles.titleOutline, { left: x, right: -x, top: y }]}
                >
                  {TITLE}
                </Text>
              ))}
              <Text style={styles.title}>{TITLE}</Text>
            </View>

            <View style={styles.card}>
              <Text style={[styles.label, styles.firstLabel]}>FULL NAME</Text>
              <TextInput
                style={[styles.input, errors.fullName && styles.inputError]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                placeholderTextColor={PLACEHOLDER}
                autoCapitalize="words"
              />
              {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}

              <Text style={styles.label}>EMAIL</Text>
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
                  placeholder="At least 8 characters"
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
              {errors.password ? (
                <Text style={styles.errorText}>{errors.password}</Text>
              ) : (
                <Text style={styles.hintText}>
                  Use a small letter, a capital letter, a number and a symbol (like ! or @).
                </Text>
              )}

              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <View style={[styles.inputRow, errors.confirm && styles.inputError]}>
                <TextInput
                  style={styles.rowInput}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Type password again"
                  placeholderTextColor={PLACEHOLDER}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable style={styles.eye} onPress={() => setShowConfirm(!showConfirm)}>
                  <Ionicons
                    name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={PLACEHOLDER}
                  />
                </Pressable>
              </View>
              {errors.confirm && <Text style={styles.errorText}>{errors.confirm}</Text>}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                loading && styles.buttonBusy,
                pressed && styles.pressed,
              ]}
              onPress={handleSignUp}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'PLEASE WAIT…' : 'CREATE ACCOUNT'}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.footer, pressed && styles.pressed]}
              onPress={() => router.replace('/login')}
            >
              <Text style={styles.footerText}>
                Already have an account? <Text style={styles.footerLink}>Login</Text>
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
  titleWrap: { alignSelf: 'center', marginTop: 14, marginBottom: 18 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  card: {
    backgroundColor: colors.cardCream,
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
  hintText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
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
    marginTop: 22,
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    letterSpacing: 1,
    color: colors.brown,
  },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  footer: {
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
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