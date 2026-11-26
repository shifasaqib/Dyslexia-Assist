import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { getChosenChild } from '../lib/child';
import { speakWord } from '../lib/speech';
import { supabase } from '../lib/supabase';
import { cleanWord } from '../lib/syllables';
import { readingFontFamily, SPEED_OPTIONS, useReadingSettings } from './reading-settings';

/* =====================================================================
   1. SMALL LOGIC FUNCTIONS (our own rules, no outside services)
   ===================================================================== */

const MIN_LETTERS = 4; // "frog" is allowed, "cat" is skipped
const MAX_QUESTIONS = 5; // ask up to 5 words
const ONLY_LETTERS = /^[a-z]+$/;

// Clean words that are good for a spelling question
const goodWords = (list: string[]) => {
  const result: string[] = [];
  for (const raw of list) {
    const word = cleanWord(raw);
    if (word && ONLY_LETTERS.test(word) && word.length >= MIN_LETTERS && !result.includes(word)) {
      result.push(word);
    }
  }
  return result;
};

// Which words to ask (up to 5): the tapped words first,
// then fill up with the longest words on the page
export function pickWords(tapped: string[], text: string): string[] {
  const chosen = goodWords(tapped).slice(0, MAX_QUESTIONS);
  const longest = goodWords(text.split(/\s+/)).sort((a, b) => b.length - a.length);
  for (const word of longest) {
    if (chosen.length >= MAX_QUESTIONS) break;
    if (!chosen.includes(word)) chosen.push(word);
  }
  return chosen;
}

// Mix a list in a random order (Fisher-Yates shuffle)
export function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Letters that dyslexic children often mirror
const MIRROR: Record<string, string> = { b: 'd', d: 'b', p: 'q', q: 'p' };

// 3 different wrong spellings, made with mistakes dyslexic children often make
export function makeWrongSpellings(word: string): string[] {
  const swaps: string[] = []; // swap two neighbouring letters: because -> becuase
  const mirrors: string[] = []; // mirror b/d and p/q: bed -> ded
  const drops: string[] = []; // drop one letter: because -> becase
  const doubles: string[] = []; // double a letter, or single a double: animal -> anniimal, butter -> buter

  for (let i = 0; i < word.length; i++) {
    const letter = word[i];
    const next = word[i + 1];
    if (next && next !== letter) swaps.push(word.slice(0, i) + next + letter + word.slice(i + 2));
    if (MIRROR[letter]) mirrors.push(word.slice(0, i) + MIRROR[letter] + word.slice(i + 1));
    drops.push(word.slice(0, i) + word.slice(i + 1));
    if (next === letter) {
      doubles.push(word.slice(0, i) + word.slice(i + 1)); // "tt" -> "t"
    } else {
      doubles.push(word.slice(0, i + 1) + letter + word.slice(i + 1)); // "n" -> "nn"
    }
  }

  const groups = [swaps, mirrors, drops, doubles].map(shuffle);
  const result: string[] = [];
  const add = (wrong?: string) => {
    if (wrong && wrong !== word && !result.includes(wrong) && result.length < 3) result.push(wrong);
  };
  groups.forEach((group) => add(group[0])); // first try one mistake of each type
  groups.forEach((group) => group.forEach(add)); // then fill up to 3
  return result;
}

// Stars for the result: 0 correct = 0 stars, under 50% = 1, 50%+ = 2, 80%+ = 3
export const starsFor = (percent: number) =>
  percent >= 80 ? 3 : percent >= 50 ? 2 : percent > 0 ? 1 : 0;

/* =====================================================================
   2. SPELLING CHECK SCREEN
   ===================================================================== */

// TODO: change to Marium's fill-in-the-blanks screen later
const NEXT_SCREEN = '/parent-home';
const GAME_TYPE = 'reading_check_spelling';
const SLOW_RATE = SPEED_OPTIONS.find((o) => o.value === 0)?.rate ?? 0.75;

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'Spelling Check';
const CARD_BORDER = '#FFE08A';
const RIGHT_BG = '#E3F7EC';
const WRONG_BG = '#FDECEF';

type Question = { word: string; options: string[] };

const readList = (value?: string): string[] => {
  try {
    const list = JSON.parse(value ?? '[]');
    return Array.isArray(list) ? list.filter((w) => typeof w === 'string') : [];
  } catch {
    return [];
  }
};

export default function SpellingCheck() {
  const router = useRouter();
  const params = useLocalSearchParams<{ words?: string; text?: string }>();
  const settings = useReadingSettings();

  // Make the questions once when the screen opens
  const questions = useMemo<Question[]>(
    () =>
      pickWords(readList(params.words), params.text ?? '').map((word) => ({
        word,
        options: shuffle([word, ...makeWrongSpellings(word)]),
      })),
    []
  );
  const total = questions.length;

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const wrongWords = useRef<string[]>([]);
  const startedAt = useRef(Date.now());
  const lastAnswerAt = useRef(Date.now());

  const question = questions[index];
  const isRight = picked !== null && picked === question?.word;

  // 🔊 say the word slowly (Azure first, phone voice as backup)
  const [voiceLoading, setVoiceLoading] = useState(false);
  const stopVoiceRef = useRef<(() => void) | null>(null);
  const stopVoice = () => {
    stopVoiceRef.current?.();
    stopVoiceRef.current = null;
    setVoiceLoading(false);
  };
  const handleSpeak = () => {
    if (!question) return;
    stopVoice();
    stopVoiceRef.current = speakWord(question.word, { rate: SLOW_RATE, onLoading: setVoiceLoading });
  };
  // Stop the voice when the question changes or the screen closes
  useEffect(() => () => stopVoice(), [index]);

  const handlePick = (option: string) => {
    if (picked !== null || !question) return;
    setPicked(option);
    lastAnswerAt.current = Date.now();
    if (option === question.word) {
      setCorrectCount((n) => n + 1);
    } else {
      wrongWords.current.push(question.word);
    }
  };

  // Save the result. If saving fails, the child still sees the result.
  const saveResults = async (correct: number) => {
    try {
      const childId = await getChosenChild();
      if (!childId) return;
      await supabase.from('game_results').insert({
        child_id: childId,
        game_type: GAME_TYPE,
        correct_count: correct,
        total_questions: total,
        time_taken_seconds: Math.round((lastAnswerAt.current - startedAt.current) / 1000),
        score_percent: Math.round((correct / total) * 100),
      });
      // Each wrong word: +1 in the difficult words list, labelled 'spelling'
      for (const word of wrongWords.current) {
        await supabase.rpc('record_difficult_word', {
          p_child_id: childId,
          p_word: word,
          p_error_type: 'spelling',
        });
      }
    } catch (e) {
      console.log('Spelling result not saved:', e);
    }
  };

  const handleNext = () => {
    stopVoice();
    if (index + 1 < total) {
      setIndex(index + 1);
      setPicked(null);
      return;
    }
    setFinished(true);
    saveResults(correctCount);
  };

  // Go to the next screen and clear the reading screens from history
  const goToNextScreen = () => {
    stopVoice();
    if (router.canDismiss()) router.dismissAll();
    router.replace(NEXT_SCREEN);
  };

  const optionTextStyle = {
    fontFamily: readingFontFamily(settings.font),
    fontSize: settings.textSize,
    letterSpacing: settings.letterSpacing,
  };

  const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const stars = starsFor(percent);

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
              style={({ pressed }) => [styles.round, pressed && styles.pressed]}
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
                adjustsFontSizeToFit
                style={[styles.title, styles.titleOutline, { left: x, right: -x, top: y }]}
              >
                {TITLE}
              </Text>
            ))}
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.title}>
              {TITLE}
            </Text>
          </View>

          {total === 0 ? (
            /* No usable words on this page */
            <>
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>No words to practise this time.</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                onPress={goToNextScreen}
              >
                <Text style={styles.buttonText}>NEXT</Text>
                <Ionicons name="arrow-forward" size={22} color={colors.brown} />
              </Pressable>
            </>
          ) : finished ? (
            /* Result */
            <>
              <View style={styles.resultCard}>
                <View style={styles.stars}>
                  {[1, 2, 3].map((n) => (
                    <Ionicons
                      key={n}
                      name={n <= stars ? 'star' : 'star-outline'}
                      size={48}
                      color={colors.yellow}
                    />
                  ))}
                </View>
                <Text style={styles.resultText}>
                  You got {correctCount} out of {total}!
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                onPress={goToNextScreen}
              >
                <Text style={styles.buttonText}>NEXT</Text>
                <Ionicons name="arrow-forward" size={22} color={colors.brown} />
              </Pressable>
            </>
          ) : (
            /* Question */
            <>
              <Text style={styles.subtitle}>Choose the correct spelling</Text>
              <Text style={styles.counter}>
                Question {index + 1} of {total}
              </Text>

              <View style={styles.speakRow}>
                <Pressable
                  style={({ pressed }) => [styles.round, styles.speak, pressed && styles.pressed]}
                  onPress={handleSpeak}
                  accessibilityLabel="Say the word"
                >
                  {voiceLoading ? (
                    <ActivityIndicator color={colors.brown} />
                  ) : (
                    <Ionicons name="volume-high" size={30} color={colors.brown} />
                  )}
                </Pressable>
              </View>
              {voiceLoading && <Text style={styles.loadingText}>Getting the voice ready…</Text>}

              {question.options.map((option) => {
                const showRight = picked !== null && option === question.word;
                const showWrong = picked === option && option !== question.word;
                return (
                  <Pressable
                    key={option}
                    style={({ pressed }) => [
                      styles.option,
                      showRight && styles.optionRight,
                      showWrong && styles.optionWrong,
                      pressed && picked === null && styles.pressed,
                    ]}
                    onPress={() => handlePick(option)}
                    disabled={picked !== null}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      maxFontSizeMultiplier={1.5}
                      style={[styles.optionText, optionTextStyle]}
                    >
                      {option}
                    </Text>
                    {showRight && (
                      <Ionicons name="checkmark-circle" size={26} color={colors.doctorGreen} />
                    )}
                  </Pressable>
                );
              })}

              {picked !== null && (
                <>
                  <View style={styles.messageBox}>
                    {isRight ? (
                      <Text style={styles.messageText}>
                        <Text style={styles.rightText}>✓ </Text>Great job!
                      </Text>
                    ) : (
                      <Text style={styles.messageText}>
                        Nice try! The correct spelling is{' '}
                        <Text style={styles.rightText}>{question.word}</Text>
                      </Text>
                    )}
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                    onPress={handleNext}
                  >
                    <Text style={styles.buttonText}>NEXT</Text>
                    <Ionicons name="arrow-forward" size={22} color={colors.brown} />
                  </Pressable>
                </>
              )}
            </>
          )}
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
  round: {
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
  speak: { width: 64, height: 64, borderRadius: 32 },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  titleWrap: { alignSelf: 'stretch', marginTop: 14, marginBottom: 10 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  subtitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.navy,
    textAlign: 'center',
  },
  counter: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  speakRow: { alignItems: 'center', marginTop: 14, marginBottom: 8 },
  loadingText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 12,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.white,
    borderBottomWidth: 6,
    borderBottomColor: colors.whiteShadow,
  },
  optionRight: {
    backgroundColor: RIGHT_BG,
    borderColor: colors.doctorGreen,
    borderBottomColor: colors.doctorGreen,
  },
  optionWrong: {
    backgroundColor: WRONG_BG,
    borderColor: colors.title,
    borderBottomColor: colors.title,
  },
  optionText: { flexShrink: 1, color: colors.navy },
  messageBox: {
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  messageText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.navy,
    textAlign: 'center',
  },
  rightText: { fontFamily: fonts.bold, color: colors.doctorGreen },
  resultCard: {
    alignItems: 'center',
    backgroundColor: colors.cardCream,
    borderWidth: 2,
    borderColor: CARD_BORDER,
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  stars: { flexDirection: 'row', gap: 8 },
  resultText: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.navy,
    textAlign: 'center',
    marginTop: 14,
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
    marginTop: 20,
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.brown,
  },
});
