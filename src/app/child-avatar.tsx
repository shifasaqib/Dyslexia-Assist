import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { AVATARS, type AvatarKey, saveChosenChild } from '../lib/child';
import { supabase } from '../lib/supabase';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'Pick your buddy!';
const ERROR = '#D93025';

export default function ChildAvatar() {
  const router = useRouter();
  const { name, age } = useLocalSearchParams<{ name: string; age: string }>();

  const [avatar, setAvatar] = useState<AvatarKey | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    if (saving) return;
    if (!avatar) {
      setError('Please pick a buddy.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { data: auth } = await supabase.auth.getSession();
      const parentId = auth.session?.user.id;
      if (!parentId) {
        router.replace('/welcome');
        return;
      }

      // Only name, age and avatar are stored (security rule 22).
      // The database also creates this child's reading settings automatically.
      const { data, error: saveError } = await supabase
        .from('children')
        .insert({ parent_id: parentId, name, age: Number(age), avatar })
        .select('id')
        .single();

      if (saveError || !data) {
        setError('We could not save right now. Please check your internet and try again.');
        return;
      }

      await saveChosenChild(data.id);
      router.replace({ pathname: '/child-hello', params: { name, avatar } });
    } catch {
      setError('Could not connect. Please check your internet and try again.');
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
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <View style={styles.topRight}>
              <View style={styles.stepPill}>
                <Text style={styles.stepText}>STEP 3 OF 3</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.back, pressed && styles.pressed]}
                onPress={() => router.back()}
                disabled={saving}
              >
                <Ionicons name="arrow-back" size={26} color={colors.brown} />
              </Pressable>
            </View>
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

          <View style={styles.grid}>
            {AVATARS.map((item) => {
              const chosen = avatar === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={({ pressed }) => [
                    styles.card,
                    chosen && styles.cardChosen,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    setAvatar(item.key);
                    setError('');
                  }}
                >
                  <View style={[styles.circle, { backgroundColor: item.circle }]}>
                    <Image source={item.image} style={styles.avatar} resizeMode="contain" />
                  </View>
                  <Text style={styles.cardText}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {error !== '' && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              saving && styles.buttonBusy,
              pressed && !saving && styles.pressed,
            ]}
            onPress={handleNext}
            disabled={saving}
          >
            <Text style={styles.buttonText}>{saving ? 'PLEASE WAIT…' : 'NEXT'}</Text>
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
  titleWrap: { alignSelf: 'center', marginTop: 24, marginBottom: 18 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
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
  },
  cardChosen: { borderColor: colors.yellow },
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
  cardText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.navy,
    marginTop: 8,
  },
  errorText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: ERROR,
    textAlign: 'center',
    marginTop: 12,
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
  buttonBusy: { opacity: 0.7 },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.brown,
  },
});
