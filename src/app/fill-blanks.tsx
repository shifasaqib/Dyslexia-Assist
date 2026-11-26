import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { makePageQuestions, type Question, questionText, scoreAnswers } from '../lib/fillBlanks';
import { supabase } from '../lib/supabase';
import { EasyReadText, useReadingSettings } from './reading-settings';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'Fill the Gap';
const CARD_BORDER = '#FFE08A';
const WRONG_BG = '#FDE7ED'; // soft pink for a wrong choice (kind, not alarming)

const TOO_SHORT = 'This page is too short for questions. Try a longer page.';

type Phase = 'loading' | 'empty' | 'playing' | 'done';

export default function FillBlanks() {
  const router = useRouter();
  // The page that was just scanned (sent from the Your Text screen)
  const { text } = useLocalSearchParams<{ text?: string }>();
  const pageText = typeof text === 'string' ? text : '';
  // The child's font and spacing, so questions look like their reading pages
  const readingSettings = useReadingSettings();

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);

  // Make 5 new random questions from this page
  const startRound = () => {
    const made = makePageQuestions(pageText);
    setQuestions(made);
    setAnswers([]);
    setCurrent(0);
    setChosen(null);
    setPhase(made.length === 0 ? 'empty' : 'playing');
  };

  useEffect(() => {
    startRound();
  }, [pageText]);

  const question = questions[current];
  const answered = chosen !== null;
  const gotItRight = answered && chosen === question?.word;

  // Save a wrong answer in difficult_words: error_type = 'fill_blank' + the exact sentence.
  // A failure here never bothers the child.
  const saveMistake = async (q: Question) => {
    try {
      const childId = await getChosenChild();
      if (!childId) return;
      await supabase.rpc('record_fill_blank_mistake', {
        p_child_id: childId,
        p_word: q.word,
        p_sentence: q.sentence,
      });
    } catch {
      // not saved this time
    }
  };

  // The child taps an option (only the first tap counts)
  const choose = (option: string) => {
    if (answered) return;
    setChosen(option);
    setAnswers([...answers, option]);
    if (question && option !== question.word) saveMistake(question);
  };

  const goNext = () => {
    if (current + 1 >= questions.length) {
      setPhase('done');
      return;
    }
    setCurrent(current + 1);
    setChosen(null);
  };

  const score = phase === 'done' ? scoreAnswers(questions, answers) : null;

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

          {phase === 'loading' && (
            <View style={styles.card}>
              <ActivityIndicator size="large" color={colors.orangeDark} />
              <Text style={styles.centerText}>Getting your words ready...</Text>
            </View>
          )}

          {phase === 'empty' && (
            <>
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>{TOO_SHORT}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.button, styles.whiteButton, pressed && styles.pressed]}
                onPress={() => router.back()}
              >
                <Ionicons name="book" size={22} color={colors.navy} />
                <Text style={[styles.buttonText, styles.whiteButtonText]}>BACK TO PAGE</Text>
              </Pressable>
            </>
          )}

          {phase === 'playing' && question && (
            <>
              <Text style={styles.progress}>
                Question {current + 1} of {questions.length}
              </Text>

              {/* The exact sentence from the child's page, with the word as a blank */}
              <View style={styles.card}>
                <EasyReadText text={questionText(question)} settings={readingSettings} />
              </View>

              <Text style={styles.prompt}>Which word goes in the gap?</Text>

              {question.options.map((option) => {
                const isAnswer = option === question.word;
                const showRight = answered && isAnswer;
                const showWrong = answered && option === chosen && !isAnswer;
                return (
                  <Pressable
                    key={option}
                    style={({ pressed }) => [
                      styles.option,
                      showRight && styles.optionRight,
                      showWrong && styles.optionWrong,
                      pressed && !answered && styles.pressed,
                    ]}
                    onPress={() => choose(option)}
                    disabled={answered}
                  >
                    {showRight && <Ionicons name="checkmark-circle" size={24} color={colors.white} />}
                    <Text
                      style={[styles.optionText, showRight && styles.optionTextRight]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}

              {answered && (
                <>
                  <View style={[styles.feedback, gotItRight && styles.feedbackRight]}>
                    <Text style={styles.feedbackText}>
                      {gotItRight
                        ? 'Well done!'
                        : `Good try! The answer is “${question.word}”.`}
                    </Text>
                  </View>

                  <Pressable
                    style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                    onPress={goNext}
                  >
                    <Text style={styles.buttonText}>
                      {current + 1 >= questions.length ? 'FINISH' : 'NEXT'}
                    </Text>
                    <Ionicons name="arrow-forward" size={22} color={colors.brown} />
                  </Pressable>
                </>
              )}
            </>
          )}

          {phase === 'done' && score && (
            <>
              <View style={styles.card}>
                <Ionicons name="star" size={48} color={colors.orange} />
                <Text style={styles.doneTitle}>All done!</Text>
                <Text style={styles.centerText}>
                  You got {score.correct} out of {score.total}.
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                onPress={startRound}
              >
                <Ionicons name="refresh" size={22} color={colors.brown} />
                <Text style={styles.buttonText}>NEW QUESTIONS</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.button, styles.whiteButton, pressed && styles.pressed]}
                onPress={() => router.back()}
              >
                <Ionicons name="book" size={22} color={colors.navy} />
                <Text style={[styles.buttonText, styles.whiteButtonText]}>BACK TO PAGE</Text>
              </Pressable>
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
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  titleWrap: { alignSelf: 'center', marginTop: 14, marginBottom: 14 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  progress: {
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.navy,
    textAlign: 'center',
    marginBottom: 12,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.cardCream,
    borderWidth: 2,
    borderColor: CARD_BORDER,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  centerText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.navy,
    textAlign: 'center',
    marginTop: 10,
  },
  prompt: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.navy,
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 28,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.white,
    borderBottomWidth: 5,
    borderBottomColor: colors.whiteShadow,
    marginTop: 12,
  },
  optionRight: {
    backgroundColor: colors.doctorGreen,
    borderColor: colors.doctorGreen,
    borderBottomColor: colors.doctorGreen,
  },
  optionWrong: {
    backgroundColor: WRONG_BG,
    borderColor: colors.title,
  },
  optionText: { fontFamily: fonts.bold, fontSize: 19, color: colors.navy },
  optionTextRight: { color: colors.white },
  feedback: {
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  feedbackRight: { borderColor: colors.doctorGreen },
  feedbackText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.navy,
    textAlign: 'center',
  },
  doneTitle: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: colors.title,
    marginTop: 8,
  },
  messageBox: {
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  messageText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    lineHeight: 23,
    color: colors.navy,
    textAlign: 'center',
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
    marginTop: 18,
  },
  whiteButton: {
    backgroundColor: colors.white,
    borderBottomColor: colors.whiteShadow,
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    letterSpacing: 1,
    color: colors.brown,
  },
  whiteButtonText: { color: colors.navy },
});
