import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';

// IMAGE PATHS: change these lines if you rename or move the images
const LOGO = require('../../assets/images/logo.png');
const SMILEY = require('../../assets/images/smiley.png');
const FIRSTAID = require('../../assets/images/firstaid.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];

export default function RoleSelect() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={[colors.skyTop, colors.skyMid, colors.mint]}
      locations={[0, 0.5, 1]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.topRow}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color={colors.brown} />
          </Pressable>
        </View>

        <View style={styles.center}>
          <View style={styles.titleWrap}>
            {OUTLINE.map(([x, y], i) => (
              <Text
                key={i}
                style={[styles.title, styles.titleOutline, { left: x, right: -x, top: y }]}
              >
                Select Your Role
              </Text>
            ))}
            <Text style={styles.title}>Select Your Role</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.cardBlue },
              pressed && styles.pressed,
            ]}
            onPress={() => router.push('/parent-signup')}
          >
            <View style={[styles.iconBox, styles.parentIconBox]}>
              <Image source={SMILEY} style={styles.iconImage} resizeMode="contain" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Parent</Text>
              <Text style={styles.cardDesc}>
                For families,{'\n'}reading setup & progress
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color={colors.navy} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.cardCream },
              pressed && styles.pressed,
            ]}
            onPress={() => router.push('/doctor-signup')}
          >
            <View style={[styles.iconBox, styles.doctorIconBox]}>
              <Image source={FIRSTAID} style={styles.iconImage} resizeMode="contain" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Doctor</Text>
              <Text style={styles.cardDesc}>
                For clinical{'\n'}evaluations & tracking
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color={colors.navy} />
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  logo: { width: 130, height: 105 },
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
  center: { flex: 1, justifyContent: 'center', paddingBottom: 60 },
  titleWrap: { alignSelf: 'center', marginBottom: 22 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  parentIconBox: {
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
  },
  doctorIconBox: { backgroundColor: colors.doctorGreen },
  iconImage: { width: 36, height: 36 },
  cardText: { flex: 1 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.navy },
  cardDesc: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 2,
  },
});