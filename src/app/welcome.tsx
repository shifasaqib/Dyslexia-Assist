import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts } from "../constants/theme";

// IMAGE PATHS: change these two lines if you rename or move the images
const LOGO = require("../../assets/images/logo.png");
const MONKEY = require("../../assets/images/monkey.png");

const OUTLINE = [
  [-2, 0],
  [2, 0],
  [0, -2],
  [0, 2],
  [-2, -2],
  [2, -2],
  [-2, 2],
  [2, 2],
];

export default function Welcome() {
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
          <Pressable
            style={styles.bulb}
            onPress={() => {
              // About page will be connected later
            }}
          >
            <Ionicons name="bulb" size={26} color={colors.brown} />
          </Pressable>
        </View>

        <View style={styles.center}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              {"“Let’s read & play together!”"}
            </Text>
          </View>
          <View style={styles.bubbleTail} />

          <View style={styles.circle}>
            <Image source={MONKEY} style={styles.monkey} resizeMode="contain" />
          </View>

          {/* <Text style={styles.title}>Welcome Friend!</Text> */}
          <View style={styles.titleWrap}>
            {OUTLINE.map(([x, y], i) => (
              <Text
                key={i}
                style={[
                  styles.title,
                  styles.titleOutline,
                  { left: x, right: -x, top: y },
                ]}
              >
                Welcome Friend!
              </Text>
            ))}
            <Text style={styles.title}>Welcome Friend!</Text>
          </View>

          <Text style={styles.subtitle}>
            Start your reading adventure with your new buddy!
          </Text>
        </View>

        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.signupButton,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/role")}
          >
            <Ionicons
              name="person-add-outline"
              size={22}
              color={colors.brown}
            />
            <Text
              style={[styles.buttonText, { color: colors.brown }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              NEW LEARNER (SIGN UP)
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.loginButton,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/login")}
          >
            <Ionicons name="arrow-forward" size={22} color="#1E6FB8" />
            <Text
              style={styles.buttonText}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              I HAVE AN ACCOUNT (LOGIN)
            </Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  logo: { width: 130, height: 105 },
  bulb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFC933",
    borderWidth: 2,
    borderColor: colors.yellow,
    borderBottomWidth: 5,
    borderBottomColor: colors.orangeDark,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bubble: {
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.yellow,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  bubbleText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.navy,
  },
  bubbleTail: {
    width: 16,
    height: 16,
    backgroundColor: colors.white,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: colors.yellow,
    transform: [{ rotate: "45deg" }],
    marginTop: -10,
    marginBottom: 6,
  },
  circle: {
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: colors.circle,
    borderWidth: 4,
    borderStyle: "dashed",
    borderColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  monkey: { width: 190, height: 190 },
  titleWrap: { marginTop: 18, alignSelf: "center" },
  title: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.title,
    textAlign: "center",
  },
  titleOutline: { position: "absolute", color: colors.white },
  subtitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    lineHeight: 24,
    color: colors.navy,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 10,
  },
  buttons: { gap: 14, paddingBottom: 24 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 17,
    paddingHorizontal: 16,
    borderRadius: 32,
    borderBottomWidth: 6,
  },
  signupButton: {
    backgroundColor: colors.orange,
    borderBottomColor: colors.orangeDark,
  },
  loginButton: {
    backgroundColor: colors.white,
    borderBottomColor: colors.whiteShadow,
  },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.navy,
    flexShrink: 1,
  },
});
