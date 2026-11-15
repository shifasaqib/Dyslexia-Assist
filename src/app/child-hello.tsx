import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { avatarFor } from '../lib/child';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const GREEN = '#22B85A';
const GREEN_DARK = '#178A42';
const PILL_BG = '#C9F2DF';
const DOT_PINK = '#F45B7A';

export default function ChildHello() {
  const router = useRouter();
  const { name, avatar } = useLocalSearchParams<{ name: string; avatar: string }>();
  const buddy = avatarFor(avatar);
  const title = `Great to meet you, ${name}!`;

  // Setup is finished: block the Android back button here
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // Clear the setup screens from history, then open Home
  const handleStart = () => {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/parent-home');
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
            <View>
              <View style={[styles.dot, styles.dotYellow]} />
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            </View>
            <View style={styles.topRight}>
              <View style={[styles.dot, styles.dotPink]} />
              <View style={styles.pill}>
                <Text style={styles.pillText}>SETUP COMPLETE!</Text>
              </View>
            </View>
          </View>

          <View style={styles.center}>
            <Image source={buddy.image} style={styles.buddy} resizeMode="contain" />

            <View style={styles.titleWrap}>
              {OUTLINE.map(([x, y], i) => (
                <Text
                  key={i}
                  style={[styles.title, styles.titleOutline, { left: x, right: -x, top: y }]}
                >
                  {title}
                </Text>
              ))}
              <Text style={styles.title}>{title}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={handleStart}
          >
            <Text style={styles.buttonText}>LET'S START</Text>
            <Ionicons name="arrow-forward" size={22} color={colors.navy} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  logo: { width: 100, height: 82 },
  topRight: { alignItems: 'flex-end' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotYellow: { backgroundColor: colors.yellow, marginBottom: 4 },
  dotPink: { backgroundColor: DOT_PINK, marginBottom: 8, marginRight: 6 },
  pill: {
    backgroundColor: PILL_BG,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pillText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.navy,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  buddy: { width: 230, height: 250 },
  titleWrap: { alignSelf: 'stretch', marginTop: 24 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.title,
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
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.navy,
  },
});
