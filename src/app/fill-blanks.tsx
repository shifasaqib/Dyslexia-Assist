import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { starsFor } from './spelling-check';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'Fill the Gap';
const CARD_BORDER = '#FFE08A';
const WRONG_BG = '#FDE7ED'; // soft pink for a wrong choice (kind, not alarming)

const TOO_SHORT = 'This page is too short for questions. Try a longer page.';
const GAME_TYPE = 'reading_check_fill_blank';

// Kind message for the final result (kindness comes from the words, not the stars)
const STAR_MESSAGES = [
  "Good try! Every reader learns step by step. Let's practise again!", // 0 stars
  "Nice effort! You're getting better!", // 1 star
  'Great reading! Keep it up!', // 2 stars
  "Amazing! You're a reading star!", // 3 stars
];

type Phase = 'loading' | 'empty' | 'playing' | 'done';

export default function FillBlanks() {
  const router = useRouter();
  // The page that was just scanned + the spelling score (sent from the Spelling Check)
  const { text, spellingCorrect, spellingTotal } = useLocalSearchParams<{
    text?: string;
    spellingCorrect?: string;
    spellingTotal?: string;
  }>();
  const pageText = typeof text === 'string' ? text : '';
  const spelling = { correct: Number(spellingCorrect) || 0, total: Number(spellingTotal) || 0 };
  // The child's font and spacing, so questions look like their reading pages
  const readingSettings = useReadingSettings();

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const lastAnswerAt = useRef(Date.now());

  // Make 5 new random questions from this page
  const startRound = () => {
    const made = makePageQuestions(pageText);
    setQuestions(made);
    setAnswers([]);
    setCurrent(0);
    setChosen(null);
    startedAt.current = Date.now();
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
    lastAnswerAt.current = Date.now();
    setChosen(option);
    setAnswers([...answers, option]);
    if (question && option !== question.word) saveMistake(question);
  };

  // Save the Fill the Gap score in game_results. A failure never bothers the child.
  const saveScore = async (correct: number, total: number) => {
    try {
      const childId = await getChosenChild();
      if (!childId || total === 0) return;
      await supabase.from('game_results').insert({
        child_id: childId,
        game_type: GAME_TYPE,
        correct_count: correct,
        total_questions: total,
        time_taken_seconds: Math.round((lastAnswerAt.current - startedAt.current) / 1000),
        score_percent: Math.round((correct / total) * 100),
      });
    } catch {
      // not saved this time
    }
  };

  const goNext = () => {
    if (current + 1 >= questions.length) {
      const final = scoreAnswers(questions, answers);
      saveScore(final.correct, final.total);
      setPhase('done');
      return;
    }
    setCurrent(current + 1);
    setChosen(null);
  };

  // Final result: Spelling + Fill the Gap (a page too short for Fill the Gap shows only Spelling)
  const fill = phase === 'done' ? scoreAnswers(questions, answers) : { correct: 0, total: 0 };
  const allCorrect = spelling.correct + fill.correct;
  const allTotal = spelling.total + fill.total;
  const stars = starsFor(allTotal > 0 ? Math.round((allCorrect / allTotal) * 100) : 0);
  const showResult = phase === 'done' || (phase === 'empty' && spelling.total > 0);

  // DONE: clear the reading screens from history and go Home
  const goHome = () => {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/parent-home');
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

          {phase === 'loading' && (
            <View style={styles.card}>
              <ActivityIndicator size="large" color={colors.orangeDark} />
              <Text style={styles.centerText}>Getting your words ready...</Text>
            </View>
          )}

          {phase === 'empty' && !showResult && (
            <>
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>{TOO_SHORT}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                onPress={goHome}
              >
                <Text style={styles.buttonText}>DONE</Text>
                <Ionicons name="home" size={22} color={colors.brown} />
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

          {showResult && (
            <>
              {/* Final result: both parts + stars for the total */}
              <View style={styles.card}>
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
                <Text style={styles.doneTitle}>All done!</Text>
                <Text style={styles.centerText}>{STAR_MESSAGES[stars]}</Text>

                <View style={styles.scoreTable}>
                  {spelling.total > 0 && (
                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreLabel}>Spelling</Text>
                      <Text style={styles.scoreValue}>
                        {spelling.correct} / {spelling.total}
                      </Text>
                    </View>
                  )}
                  {fill.total > 0 && (
                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreLabel}>Fill the Gap</Text>
                      <Text style={styles.scoreValue}>
                        {fill.correct} / {fill.total}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.scoreRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>
                      {allCorrect} / {allTotal}
                    </Text>
                  </View>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                onPress={goHome}
              >
                <Text style={styles.buttonText}>DONE</Text>
                <Ionicons name="home" size={22} color={colors.brown} />
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
  stars: { flexDirection: 'row', gap: 8 },
  scoreTable: { alignSelf: 'stretch', marginTop: 18 },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalRow: { borderTopWidth: 2, borderTopColor: CARD_BORDER, marginTop: 4 },
  scoreLabel: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.navy },
  scoreValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
  totalLabel: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy },
  totalValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.title },
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
