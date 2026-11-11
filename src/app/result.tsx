import { Ionicons } from '@expo/vector-icons';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { supabase } from '../lib/supabase';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'Your Text';
const CARD_BORDER = '#FFE08A';

const NOT_ANSWERING = 'The simplify service is not answering. Please try again.';
const AI_NOTE = 'Made simpler by AI. Ask a grown-up if something looks wrong.';
const NO_TEXT = 'No text yet. Scan a page first.';

// A line that ends like this finishes a sentence (or a heading like "Ans:" or "[6]")
const SENTENCE_END = /[.!?:;\])"”]$/;

// OCR copies the line breaks of the printed page, so sentences get cut in the middle.
// This joins those lines back together, keeps real paragraphs (blank lines),
// and fixes words split with a dash at the end of a line ("commer-" + "cial").
const tidyText = (raw: string) =>
  raw
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const lines = paragraph
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');
      let joined = '';
      for (const line of lines) {
        if (joined === '') {
          joined = line;
        } else if (/[a-z]-$/.test(joined) && /^[a-z]/.test(line)) {
          joined = joined.slice(0, -1) + line; // word split with a dash
        } else if (SENTENCE_END.test(joined)) {
          joined += '\n' + line; // sentence finished, start a new line
        } else {
          joined += ' ' + line; // sentence continues, join with a space
        }
      }
      return joined;
    })
    .filter((paragraph) => paragraph !== '')
    .join('\n\n');

// Remove formatting symbols the AI sometimes adds (bold, headings, bullets)
const cleanAiText = (raw: string) =>
  raw
    .replace(/\*\*|__/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

type Mode = 'original' | 'simple';

export default function Result() {
  const router = useRouter();
  // Real text sent from the Scan screen (after OCR)
  const { text } = useLocalSearchParams<{ text?: string }>();
  const originalText = typeof text === 'string' ? tidyText(text) : '';
  const hasText = originalText !== '';

  const [simpleText, setSimpleText] = useState('');
  const [mode, setMode] = useState<Mode>('original');
  const [simplifying, setSimplifying] = useState(false);
  const [message, setMessage] = useState('');

  const showingSimple = mode === 'simple' && simpleText !== '';

  // Send the text to our "simplify" server function and keep the simple version
  const handleSimplify = async () => {
    setMessage('');
    setSimplifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('simplify', {
        body: { text: originalText },
      });

      if (error) {
        let errorMessage = NOT_ANSWERING;
        // The server sends its own kind message (e.g. "too long"), show that one
        if (error instanceof FunctionsHttpError) {
          try {
            const details = await error.context.json();
            if (typeof details?.error === 'string') errorMessage = details.error;
          } catch {
            // keep the default message
          }
        }
        setMessage(errorMessage);
        return;
      }

      const result = typeof data?.simpleText === 'string' ? cleanAiText(data.simpleText) : '';
      if (result === '') {
        setMessage('We could not make this text simpler. Please try again.');
        return;
      }

      setSimpleText(result);
      setMode('simple');
    } catch {
      setMessage(NOT_ANSWERING);
    } finally {
      setSimplifying(false);
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

          {!hasText ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{NO_TEXT}</Text>
            </View>
          ) : simpleText === '' ? (
            <Pressable
              style={({ pressed }) => [styles.button, styles.simplifyButton, pressed && styles.pressed]}
              onPress={handleSimplify}
              disabled={simplifying}
            >
              {simplifying ? (
                <>
                  <ActivityIndicator color={colors.brown} />
                  <Text style={styles.buttonText}>Making it simpler...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={22} color={colors.brown} />
                  <Text style={styles.buttonText}>MAKE IT SIMPLER</Text>
                </>
              )}
            </Pressable>
          ) : (
            <View style={styles.switchRow}>
              <Pressable
                style={[styles.switchOption, mode === 'original' && styles.switchActive]}
                onPress={() => setMode('original')}
              >
                <Text
                  style={[styles.switchText, mode === 'original' && styles.switchTextActive]}
                >
                  ORIGINAL
                </Text>
              </Pressable>
              <Pressable
                style={[styles.switchOption, mode === 'simple' && styles.switchActive]}
                onPress={() => setMode('simple')}
              >
                <Text style={[styles.switchText, mode === 'simple' && styles.switchTextActive]}>
                  SIMPLE
                </Text>
              </Pressable>
            </View>
          )}

          {message !== '' && (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          )}

          {hasText && (
            <View style={styles.card}>
              {showingSimple && <Text style={styles.aiNote}>{AI_NOTE}</Text>}
              <Text style={styles.readingText}>{showingSimple ? simpleText : originalText}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => router.back()}
          >
            <Ionicons name="camera" size={22} color={colors.brown} />
            <Text style={styles.buttonText}>SCAN ANOTHER PAGE</Text>
          </Pressable>
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
  titleWrap: { alignSelf: 'center', marginTop: 14, marginBottom: 14 },
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
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  // Dyslexia-friendly text: big, extra letter and line spacing, left aligned
  readingText: {
    fontFamily: fonts.regular,
    fontSize: 20,
    lineHeight: 34,
    letterSpacing: 0.6,
    color: colors.navy,
    textAlign: 'left',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    paddingHorizontal: 16,
    borderRadius: 32,
    backgroundColor: colors.orange,
    borderBottomWidth: 6,
    borderBottomColor: colors.orangeDark,
    marginTop: 22,
  },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  simplifyButton: { marginTop: 0, marginBottom: 16 },
  switchRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: 28,
    borderBottomWidth: 4,
    borderBottomColor: colors.whiteShadow,
    padding: 4,
    marginBottom: 16,
  },
  switchOption: {
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 24,
  },
  switchActive: { backgroundColor: colors.orange },
  switchText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    letterSpacing: 1,
    color: colors.muted,
  },
  switchTextActive: { color: colors.brown },
  messageBox: {
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  messageText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 22,
    color: colors.navy,
    textAlign: 'center',
  },
  aiNote: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginBottom: 12,
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    letterSpacing: 1,
    color: colors.brown,
  },
});
