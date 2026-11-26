import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { readingFontFamily, type ReadingSettings, SPEED_OPTIONS } from '../app/reading-settings';
import { colors, fonts } from '../constants/theme';
import { getChosenChild } from './child';
import { pauseReading, speakWord } from './speech';
import { supabase } from './supabase';

/* =====================================================================
   1. SPLIT WORDS INTO SYLLABLES
   First the FIX LIST (common hard words with correct splits),
   otherwise the "hyphen" package (en-us patterns, works offline).
   ===================================================================== */

// "hyphen" has no TypeScript types, so it is loaded with require
const { hyphenateSync } = require('hyphen/en-us') as {
  hyphenateSync: (text: string, options?: { hyphenChar?: string; minWordLength?: number }) => string;
};

const SOFT_HYPHEN = '­';

// Common hard words with the correct split. Add more here when a split looks wrong.
export const FIX_LIST: Record<string, string> = {
  elephant: 'el-e-phant',
  dinosaur: 'di-no-saur',
  umbrella: 'um-brel-la',
  // Added after the 30-word test (hyphen got these wrong)
  computer: 'com-pu-ter',
  banana: 'ba-na-na',
  library: 'li-brar-y',
  vegetable: 'veg-e-ta-ble',
  caterpillar: 'cat-er-pil-lar',
  favorite: 'fa-vor-ite',
  chocolate: 'choc-o-late',
  february: 'feb-ru-ar-y',
  necessary: 'nec-es-sar-y',
  helicopter: 'hel-i-cop-ter',
};

// Remove punctuation at the start and end of a word: "(Hello!" -> "Hello"
const trimPunctuation = (word: string) =>
  word.replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9]+$/, '');

// Split one part with no dashes (FIX LIST first, then hyphen).
// Keeps the original capital letters.
const splitPart = (part: string): string[] => {
  const fixed = FIX_LIST[part.toLowerCase()];
  if (fixed && fixed.replace(/-/g, '') === part.toLowerCase()) {
    const pieces: string[] = [];
    let start = 0;
    for (const piece of fixed.split('-')) {
      pieces.push(part.slice(start, start + piece.length));
      start += piece.length;
    }
    return pieces;
  }
  return hyphenateSync(part, { hyphenChar: SOFT_HYPHEN, minWordLength: 4 })
    .split(SOFT_HYPHEN)
    .filter((p) => p !== '');
};

// splitSyllables("Elephant,") -> { word: "Elephant", parts: ["El", "e", "phant"] }
// Numbers and one-syllable words come back as one part.
export function splitSyllables(original: string): { word: string; parts: string[] } {
  const word = trimPunctuation(original) || original;
  if (/\d/.test(word) || !/[A-Za-z]/.test(word)) {
    return { word, parts: [word] };
  }
  const whole = FIX_LIST[word.toLowerCase()];
  if (whole) return { word, parts: splitPart(word) };

  // Words with a dash ("well-known") are split part by part
  const parts = word
    .split('-')
    .filter((p) => p !== '')
    .flatMap(splitPart);
  return { word, parts: parts.length > 0 ? parts : [word] };
}

// Word to save: lowercase, no punctuation. Numbers are not saved (returns null).
export function cleanWord(original: string): string | null {
  const word = trimPunctuation(original).toLowerCase();
  if (word === '' || /\d/.test(word) || !/[a-z]/.test(word)) return null;
  if (word.length > 40) return null;
  return word;
}

/* =====================================================================
   2. TEST: 30 common difficult words for children
   checkSyllables() returns each result and the score.
   ===================================================================== */

export const TEST_WORDS: Record<string, string> = {
  because: 'be-cause',
  elephant: 'el-e-phant',
  dinosaur: 'di-no-saur',
  umbrella: 'um-brel-la',
  butterfly: 'but-ter-fly',
  beautiful: 'beau-ti-ful',
  different: 'dif-fer-ent',
  important: 'im-por-tant',
  animal: 'an-i-mal',
  family: 'fam-i-ly',
  computer: 'com-pu-ter',
  banana: 'ba-na-na',
  tomorrow: 'to-mor-row',
  yesterday: 'yes-ter-day',
  together: 'to-geth-er',
  remember: 're-mem-ber',
  birthday: 'birth-day',
  adventure: 'ad-ven-ture',
  library: 'li-brar-y',
  hospital: 'hos-pi-tal',
  vegetable: 'veg-e-ta-ble',
  caterpillar: 'cat-er-pil-lar',
  difficult: 'dif-fi-cult',
  interesting: 'in-ter-est-ing',
  favorite: 'fa-vor-ite',
  chocolate: 'choc-o-late',
  february: 'feb-ru-ar-y',
  necessary: 'nec-es-sar-y',
  kangaroo: 'kan-ga-roo',
  helicopter: 'hel-i-cop-ter',
};

export function checkSyllables() {
  const results = Object.entries(TEST_WORDS).map(([word, expected]) => {
    const got = splitSyllables(word).parts.join('-').toLowerCase();
    return { word, expected, got, correct: got === expected };
  });
  const correct = results.filter((r) => r.correct).length;
  return { results, correct, total: results.length };
}

/* =====================================================================
   3. TAP A WORD -> POPUP + SAVE TO difficult_words
   ===================================================================== */

const PART_COLORS = [colors.title, '#1E88D9', colors.doctorGreen, colors.orangeDark, '#8E5BD9'];
const CARD_BORDER = '#FFE08A';
const OVERLAY = 'rgba(11, 42, 74, 0.55)';
// The word is said at the Slow read-aloud speed
const SLOW_RATE = SPEED_OPTIONS.find((o) => o.value === 0)?.rate ?? 0.75;

function WordPopup({
  word,
  settings,
  onClose,
}: {
  word: string | null;
  settings: ReadingSettings;
  onClose: () => void;
}) {
  const split = word ? splitSyllables(word) : null;
  const count = split?.parts.length ?? 0;

  // 🔊 voice for this word (Azure first, phone voice as backup)
  const [voiceLoading, setVoiceLoading] = useState(false);
  const stopVoiceRef = useRef<(() => void) | null>(null);

  const stopVoice = () => {
    stopVoiceRef.current?.();
    stopVoiceRef.current = null;
    setVoiceLoading(false);
  };

  // A second tap restarts the word (the old voice is stopped first)
  const handleSpeak = () => {
    if (!split) return;
    stopVoice();
    stopVoiceRef.current = speakWord(split.word, { rate: SLOW_RATE, onLoading: setVoiceLoading });
  };

  const handleClose = () => {
    stopVoice();
    onClose();
  };

  // A new word (or the popup going away) stops the old word's voice
  useEffect(() => () => stopVoice(), [word]);

  return (
    <Modal visible={split !== null} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={popupStyles.overlay}>
        <View style={popupStyles.card}>
          {split && (
            <>
              {/* Word in the child's reading font, size x 2. Long words shrink to fit. */}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.3}
                maxFontSizeMultiplier={1.5}
                style={[
                  popupStyles.word,
                  {
                    fontFamily: readingFontFamily(settings.font),
                    fontSize: settings.textSize * 2,
                    letterSpacing: settings.letterSpacing,
                  },
                ]}
              >
                {split.parts.map((part, i) => (
                  <Text key={i}>
                    {i > 0 && <Text style={popupStyles.dot}>{' · '}</Text>}
                    <Text style={{ color: PART_COLORS[i % PART_COLORS.length] }}>{part}</Text>
                  </Text>
                ))}
              </Text>

              <Text style={popupStyles.count}>{count === 1 ? '1 part' : `${count} parts`}</Text>

              <View style={popupStyles.buttonRow}>
                {/* 🔊 say the word slowly (spinner while Azure loads) */}
                <Pressable
                  style={({ pressed }) => [popupStyles.speak, pressed && popupStyles.pressed]}
                  onPress={handleSpeak}
                  accessibilityLabel="Say the word"
                >
                  {voiceLoading ? (
                    <ActivityIndicator color={colors.brown} />
                  ) : (
                    <Ionicons name="volume-high" size={30} color={colors.brown} />
                  )}
                </Pressable>

                <Pressable
                  style={({ pressed }) => [popupStyles.button, pressed && popupStyles.pressed]}
                  onPress={handleClose}
                >
                  <Text style={popupStyles.buttonText}>CLOSE</Text>
                </Pressable>
              </View>

              {voiceLoading && <Text style={popupStyles.loadingText}>Getting the voice ready…</Text>}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Fill-in-the-Blanks (Marium): find the EXACT sentence of the page that the tapped word is in.
// wordNumber = the word's number in the whole text (0 = first word), as EasyReadText sends it.
// The sentence is copied from the text as it is (nothing is changed or made up).
// Returns null if it cannot be found, or if the word is not really inside it.
export function sentenceAt(text: string, wordNumber: number, clean: string): string | null {
  // Where the tapped word starts and ends in the text
  let count = -1;
  let start = -1;
  let end = -1;
  for (const match of text.matchAll(/\S+/g)) {
    count += 1;
    if (count === wordNumber) {
      start = match.index ?? 0;
      end = start + match[0].length;
      break;
    }
  }
  if (start < 0) return null;

  // Back to the start of the sentence (just after . ! ? or a new line)
  let from = start;
  while (from > 0 && !/[.!?\n]/.test(text[from - 1])) from -= 1;

  // Forward to the end of the sentence (. ! ? and any closing quote/bracket, or a new line)
  let to = start;
  while (to < text.length && !/[.!?\n]/.test(text[to])) to += 1;
  while (to < text.length && /[.!?"”'’)\]]/.test(text[to])) to += 1;
  if (to < end) to = end;

  const sentence = text.slice(from, to).trim();
  if (sentence === '' || sentence.length > 500) return null;

  // Safety check: the tapped word must really be one of the sentence's words
  const sentenceWords = sentence.split(/\s+/).map(cleanWord);
  return sentenceWords.includes(clean) ? sentence : null;
}

// Hook for the reading screen: gives onWordPress for EasyReadText and the popup.
// Each word is saved only once per visit. Saving never blocks the child.
// text = the page text on screen (used to save the exact sentence for Fill-in-the-Blanks).
export function useWordBreakdown(settings: ReadingSettings, text?: string) {
  const [tapped, setTapped] = useState<string | null>(null);
  const savedThisVisit = useRef(new Set<string>());

  const saveWord = async (clean: string, sentence: string | null) => {
    try {
      const childId = await getChosenChild();
      if (!childId) return;
      const { error } = await supabase.rpc('record_difficult_word', {
        p_child_id: childId,
        p_word: clean,
      });
      // Not saved: allow it to be saved on the next tap
      if (error) {
        savedThisVisit.current.delete(clean);
        return;
      }
      // Fill-in-the-Blanks: also keep the exact sentence (a failure here never bothers the child)
      if (sentence) {
        await supabase.rpc('save_word_sentence', {
          p_child_id: childId,
          p_word: clean,
          p_sentence: sentence,
        });
      }
    } catch {
      savedThisVisit.current.delete(clean);
    }
  };

  const onWordPress = (word: string, index?: number) => {
    // If the page is being read aloud, pause it (it keeps its place for PLAY)
    pauseReading();
    setTapped(word);
    const clean = cleanWord(word);
    if (!clean || savedThisVisit.current.has(clean)) return;
    savedThisVisit.current.add(clean);
    const sentence = text && index !== undefined ? sentenceAt(text, index, clean) : null;
    saveWord(clean, sentence);
  };

  const popup = <WordPopup word={tapped} settings={settings} onClose={() => setTapped(null)} />;

  return { onWordPress, popup };
}

const popupStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    backgroundColor: colors.cardCream,
    borderWidth: 3,
    borderColor: CARD_BORDER,
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  word: {
    alignSelf: 'stretch',
    textAlign: 'center',
    color: colors.navy,
  },
  dot: { color: colors.muted },
  count: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.navy,
    marginTop: 14,
  },
  buttonRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  speak: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFC933',
    borderWidth: 2,
    borderColor: colors.yellow,
    borderBottomWidth: 5,
    borderBottomColor: colors.orangeDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 32,
    backgroundColor: colors.orange,
    borderBottomWidth: 6,
    borderBottomColor: colors.orangeDark,
  },
  loadingText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.muted,
    marginTop: 10,
  },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.brown,
  },
});
