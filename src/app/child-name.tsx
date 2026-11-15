import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
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
import { logOut } from '../lib/auth';
import { cleanName, NAME_RULE } from '../lib/child';

// IMAGE PATHS: change these lines if you rename or move the images
const LOGO = require('../../assets/images/logo.png');
const MONKEY = require('../../assets/images/monkey.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = "Hi! What's your name?";
const CIRCLE_COLOR = '#E2D36C';
const PLACEHOLDER = '#8A9AAA';
const ERROR = '#D93025';

export default function ChildName() {
  const router = useRouter();
  // from = 'select' when opened with "Add Child" on the Who's Reading? screen
  const { from } = useLocalSearchParams<{ from?: string }>();
  const addingMore = from === 'select';

  const [name, setName] = useState('');
  const [error, setError] = useState('');

  // Back: if adding another child, go back to Who's Reading?.
  // On the very first setup there is no screen to go back to, so offer to log out.
  const handleBack = () => {
    if (addingMore) {
      router.back();
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

  const handleNext = () => {
    const clean = cleanName(name);
    if (clean.length === 0) {
      setError('Please enter your name.');
      return;
    }
    if (!NAME_RULE.test(clean)) {
      setError('Name can only have letters.');
      return;
    }
    setError('');
    router.push({ pathname: '/child-age', params: { name: clean } });
  };

  return (
    <LinearGradient
      colors={[colors.skyTop, colors.skyMid, colors.mint]}
      locations={[0, 0.5, 1]}
      style={styles.gradient}
    >
      <Stack.Screen options={{ gestureEnabled: addingMore }} />
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
              <View style={styles.topRight}>
                <View style={styles.stepPill}>
                  <Text style={styles.stepText}>STEP 1 OF 3</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.back, pressed && styles.pressed]}
                  onPress={handleBack}
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

            <TextInput
              style={[styles.input, error !== '' && styles.inputError]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError('');
              }}
              placeholder="Type your name"
              placeholderTextColor={PLACEHOLDER}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
              returnKeyType="next"
              onSubmitEditing={handleNext}
            />
            {error !== '' && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              onPress={handleNext}
            >
              <Text style={styles.buttonText}>NEXT</Text>
              <Ionicons name="arrow-forward" size={22} color={colors.brown} />
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
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: CIRCLE_COLOR,
    borderWidth: 4,
    borderStyle: 'dashed',
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  mascot: { width: 150, height: 160 },
  titleWrap: { alignSelf: 'center', marginTop: 20, marginBottom: 18 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  input: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.navy,
    textAlign: 'center',
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.white,
    borderBottomWidth: 4,
    borderBottomColor: colors.whiteShadow,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  inputError: { borderColor: ERROR, borderBottomColor: ERROR },
  errorText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: ERROR,
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
    marginTop: 26,
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.brown,
  },
});
