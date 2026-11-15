import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { logOut } from '../lib/auth';
import { avatarFor, type Child, saveChosenChild } from '../lib/child';
import { supabase } from '../lib/supabase';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = "Who's Reading?";

export default function ChildSelect() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [leaving, setLeaving] = useState(false);

  // Load this parent's children each time the screen is shown.
  // RLS makes sure only this parent's children come back.
  const loadChildren = useCallback(async () => {
    setLoading(true);
    setMessage('');
    const { data, error } = await supabase
      .from('children')
      .select('id, name, age, avatar')
      .order('created_at', { ascending: true });
    setLoading(false);

    if (error) {
      setMessage('Could not load. Please check your internet and try again.');
      return;
    }
    if (!data || data.length === 0) {
      router.replace('/child-name');
      return;
    }
    setChildren(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadChildren();
    }, [loadChildren])
  );

  // This is a start screen: the Android back button does nothing here
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const chooseChild = async (child: Child) => {
    await saveChosenChild(child.id);
    if (router.canDismiss()) router.dismissAll();
    router.replace('/parent-home');
  };

  const handleLogOut = async () => {
    if (leaving) return;
    setLeaving(true);
    await logOut();
    router.replace('/welcome');
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

          {loading ? (
            <ActivityIndicator size="large" color={colors.orangeDark} style={styles.loader} />
          ) : message !== '' ? (
            <Pressable
              style={({ pressed }) => [styles.messageBox, pressed && styles.pressed]}
              onPress={loadChildren}
            >
              <Text style={styles.messageText}>{message}</Text>
              <Text style={styles.retryText}>Tap to try again</Text>
            </Pressable>
          ) : (
            <View style={styles.grid}>
              {children.map((child) => {
                const buddy = avatarFor(child.avatar);
                return (
                  <Pressable
                    key={child.id}
                    style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                    onPress={() => chooseChild(child)}
                  >
                    <View style={[styles.circle, { backgroundColor: buddy.circle }]}>
                      <Image source={buddy.image} style={styles.avatar} resizeMode="contain" />
                    </View>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {child.name}
                    </Text>
                    {child.age !== null && <Text style={styles.cardAge}>Age {child.age}</Text>}
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/child-name', params: { from: 'select' } })}
          >
            <Ionicons name="add-circle" size={24} color={colors.brown} />
            <Text style={styles.buttonText}>ADD CHILD</Text>
          </Pressable>

          <View style={styles.spacer} />

          <View style={styles.links}>
            <Pressable
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              onPress={() => router.push('/parent-pin')}
            >
              <Ionicons name="lock-closed" size={16} color={colors.navy} />
              <Text style={styles.linkText}>Parent Zone</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              onPress={handleLogOut}
              disabled={leaving}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.navy} />
              <Text style={styles.linkText}>{leaving ? 'Please wait…' : 'Log out'}</Text>
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
  titleWrap: { alignSelf: 'center', marginTop: 16, marginBottom: 20 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  loader: { marginVertical: 40 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  card: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.white,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  circle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 70, height: 74 },
  cardName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.navy,
    marginTop: 8,
  },
  cardAge: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  messageBox: {
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  messageText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 22,
    color: colors.navy,
    textAlign: 'center',
  },
  retryText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.navy,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: 6,
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
    marginTop: 24,
  },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.brown,
  },
  spacer: { flex: 1, minHeight: 28 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  linkText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.navy,
  },
});
