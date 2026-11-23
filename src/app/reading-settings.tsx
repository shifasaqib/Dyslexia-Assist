import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { getChosenChild } from '../lib/child';
import { supabase } from '../lib/supabase';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

/* =====================================================================
   1. READING SETTINGS (shared with the reading screen and Home)
   Uses only the existing reading_settings columns:
   font, text_size, letter_spacing, line_spacing.
   ===================================================================== */

export type ReadingFont = 'Lexend' | 'OpenDyslexic';

// Read-aloud speed (Feature 5): 0 = Slow, 1 = Normal, 2 = Fast
export type SpeechSpeed = 0 | 1 | 2;

export type ReadingSettings = {
  font: ReadingFont;
  textSize: number;
  letterSpacing: number;
  lineSpacing: number;
  speechSpeed: SpeechSpeed;
};

export const DEFAULT_SETTINGS: ReadingSettings = {
  font: 'Lexend',
  textSize: 18,
  letterSpacing: 0.5,
  lineSpacing: 1.5,
  speechSpeed: 1,
};

// The 3 read-aloud speeds (shared by the reading screen and this settings screen).
// rate = how fast the voice reads (1 = normal speed)
export const SPEED_OPTIONS: {
  value: SpeechSpeed;
  label: string;
  rate: number;
  note: string;
}[] = [
  { value: 0, label: 'Slow', rate: 0.75, note: '0.75x' },
  { value: 1, label: 'Normal', rate: 1.0, note: '1x' },
  { value: 2, label: 'Fast', rate: 1.25, note: '1.25x' },
];

const FONT_OPTIONS: { value: ReadingFont; label: string; family: string }[] = [
  { value: 'Lexend', label: 'Lexend', family: fonts.bold },
  { value: 'OpenDyslexic', label: 'OpenDyslexic', family: 'OpenDyslexic_Bold' },
];
const SIZE_OPTIONS = [16, 18, 22, 26];
const LETTER_OPTIONS = [
  { value: 0.5, label: 'Normal' },
  { value: 1.5, label: 'Wide' },
  { value: 2.5, label: 'Extra Wide' },
];
const LINE_OPTIONS = [1.5, 2.0, 2.5];

// Font name for the reading text (buttons and titles always stay Lexend)
export const readingFontFamily = (font: ReadingFont) =>
  font === 'OpenDyslexic' ? 'OpenDyslexic_Regular' : fonts.regular;

// If a saved value is not one of our presets, use the closest preset
const closest = (value: unknown, options: number[], fallback: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return options.reduce((best, o) => (Math.abs(o - n) < Math.abs(best - n) ? o : best));
};

type SettingsRow = {
  font: string | null;
  text_size: number | null;
  letter_spacing: number | string | null;
  line_spacing: number | string | null;
  speech_speed: number | null;
};

// Only 0, 1 or 2 are allowed; anything else becomes Normal
const toSpeechSpeed = (value: unknown): SpeechSpeed =>
  value === 0 || value === 1 || value === 2 ? value : DEFAULT_SETTINGS.speechSpeed;

const fromRow = (row: SettingsRow): ReadingSettings => ({
  font: row.font === 'OpenDyslexic' ? 'OpenDyslexic' : 'Lexend',
  textSize: closest(row.text_size, SIZE_OPTIONS, DEFAULT_SETTINGS.textSize),
  letterSpacing: closest(
    row.letter_spacing,
    LETTER_OPTIONS.map((o) => o.value),
    DEFAULT_SETTINGS.letterSpacing
  ),
  lineSpacing: closest(row.line_spacing, LINE_OPTIONS, DEFAULT_SETTINGS.lineSpacing),
  speechSpeed: toSpeechSpeed(row.speech_speed),
});

// Small shared memory: the settings are loaded ONCE per chosen child
// and every reading screen reads them from here.
let cache: { childId: string; settings: ReadingSettings } | null = null;
const listeners = new Set<() => void>();

const setCache = (childId: string, settings: ReadingSettings) => {
  cache = { childId, settings };
  listeners.forEach((update) => update());
};

// Load the chosen child's settings (skipped if this child is already loaded).
// RLS allows only the parent's own children.
export async function loadReadingSettings(childId: string): Promise<ReadingSettings> {
  if (cache?.childId === childId) return cache.settings;

  const { data, error } = await supabase
    .from('reading_settings')
    .select('font, text_size, letter_spacing, line_spacing, speech_speed')
    .eq('child_id', childId)
    .maybeSingle();
  if (error) throw error;

  const settings = data ? fromRow(data) : DEFAULT_SETTINGS;
  setCache(childId, settings);
  return settings;
}

// Save the settings for this child. "upsert" also creates the row
// for older children that were made before the automatic trigger existed.
export async function saveReadingSettings(childId: string, settings: ReadingSettings) {
  const { error } = await supabase.from('reading_settings').upsert(
    {
      child_id: childId,
      font: settings.font,
      text_size: settings.textSize,
      letter_spacing: settings.letterSpacing,
      line_spacing: settings.lineSpacing,
      speech_speed: settings.speechSpeed,
    },
    { onConflict: 'child_id' }
  );
  if (error) throw error;
  setCache(childId, settings);
}

// Save ONLY the read-aloud speed (font and spacing stay as they are).
// Used when the child taps Slow / Normal / Fast on the reading screen.
export async function saveSpeechSpeed(childId: string, speechSpeed: SpeechSpeed) {
  const { error } = await supabase
    .from('reading_settings')
    .upsert({ child_id: childId, speech_speed: speechSpeed }, { onConflict: 'child_id' });
  if (error) throw error;
  if (cache?.childId === childId) {
    setCache(childId, { ...cache.settings, speechSpeed });
  }
}

// Hook for reading screens: gives the chosen child's settings
// (defaults until they are loaded, or if loading fails).
export function useReadingSettings(): ReadingSettings {
  const [settings, setSettings] = useState<ReadingSettings>(
    cache?.settings ?? DEFAULT_SETTINGS
  );

  useEffect(() => {
    const update = () => setSettings(cache?.settings ?? DEFAULT_SETTINGS);
    listeners.add(update);
    (async () => {
      const childId = await getChosenChild();
      if (childId) {
        try {
          await loadReadingSettings(childId);
        } catch {
          // keep the defaults
        }
      }
      update();
    })();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return settings;
}

/* =====================================================================
   2. EASY READ TEXT (always on, nothing saved)
   - short chunks of 2 to 3 sentences with a gap between them
   - every word is its own Text, so a word never breaks across lines
     (and each word is ready for read-aloud highlighting later)
   - lines of about 50 characters, never wider than the screen
   - left aligned, word gap grows with letter spacing
   ===================================================================== */

const TARGET_CHARS = 50; // about 45 to 55 characters per line
const MAX_TEXT_SCALE = 1.5; // phone large-text setting may grow text up to 1.5x
const LONG_CHUNK = 160; // a chunk stops at 2 sentences when it is already this long
const SENTENCE = /[^.!?]+(?:[.!?]+["'”’)\]]*|$)/g;

// Split text into chunks (2 or 3 sentences each), each chunk is a list of words
export function makeChunks(text: string): string[][] {
  const chunks: string[][] = [];
  for (const paragraph of text.split(/\n\s*\n/)) {
    const sentences = (paragraph.replace(/\s+/g, ' ').match(SENTENCE) ?? [])
      .map((s) => s.trim())
      .filter((s) => s !== '');

    let current: string[] = [];
    let length = 0;
    for (const sentence of sentences) {
      current.push(sentence);
      length += sentence.length;
      if (current.length === 3 || (current.length === 2 && length > LONG_CHUNK)) {
        chunks.push(current.join(' ').split(' ').filter((w) => w !== ''));
        current = [];
        length = 0;
      }
    }
    if (current.length > 0) {
      chunks.push(current.join(' ').split(' ').filter((w) => w !== ''));
    }
  }
  return chunks;
}

export function EasyReadText({
  text,
  settings,
  onWordPress,
  highlightWord,
}: {
  text: string;
  settings: ReadingSettings;
  // Optional: tap a word (word, its number in the whole text). Not set = words are not tappable.
  onWordPress?: (word: string, index: number) => void;
  // Optional (read aloud): number of the word being spoken (0 = first word). It gets a yellow background.
  highlightWord?: number | null;
}) {
  const { fontScale } = useWindowDimensions();
  const [boxWidth, setBoxWidth] = useState(0);
  const chunks = useMemo(() => makeChunks(text), [text]);
  // Number of the first word in each chunk, so every word keeps ONE number
  // across the whole text (used by both the word tap and the read-aloud highlight)
  const chunkStarts = useMemo(() => {
    let count = 0;
    return chunks.map((words) => {
      const start = count;
      count += words.length;
      return start;
    });
  }, [chunks]);

  const scale = Math.min(fontScale, MAX_TEXT_SCALE);
  const shownSize = settings.textSize * scale;
  // Rough width of one letter for this font, size and letter spacing
  const charWidth =
    shownSize * (settings.font === 'OpenDyslexic' ? 0.62 : 0.55) + settings.letterSpacing;
  const lineWidth = boxWidth > 0 ? Math.min(boxWidth, charWidth * TARGET_CHARS) : undefined;

  const wordGap = settings.textSize * 0.3 + settings.letterSpacing * 2;
  const lineHeight = settings.textSize * settings.lineSpacing;
  const chunkGap = shownSize * settings.lineSpacing * 0.8;

  const wordStyle = {
    fontFamily: readingFontFamily(settings.font),
    fontSize: settings.textSize,
    lineHeight,
    letterSpacing: settings.letterSpacing,
    marginRight: wordGap,
  };

  return (
    <View onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
      <View style={lineWidth ? { width: lineWidth } : undefined}>
        {chunks.map((words, c) => (
          <View
            key={c}
            style={[easyStyles.chunk, c < chunks.length - 1 && { marginBottom: chunkGap }]}
          >
            {words.map((word, w) => {
              const index = chunkStarts[c] + w;
              return (
                <Text
                  key={index}
                  style={[easyStyles.word, wordStyle, highlightWord === index && easyStyles.spoken]}
                  maxFontSizeMultiplier={MAX_TEXT_SCALE}
                  android_hyphenationFrequency="none"
                  textBreakStrategy="simple"
                  onPress={onWordPress ? () => onWordPress(word, index) : undefined}
                >
                  {word}
                </Text>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const easyStyles = StyleSheet.create({
  chunk: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  word: { color: colors.navy, textAlign: 'left' },
  // The word being read aloud
  spoken: { backgroundColor: colors.yellow, borderRadius: 6, overflow: 'hidden' },
});

/* =====================================================================
   3. READING SETTINGS SCREEN
   ===================================================================== */

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'Reading Settings';
const CARD_BORDER = '#FFE08A';
const ERROR = '#D93025';
const SAMPLE =
  'Sam has a red kite. He runs to the park with his dog. The wind lifts the kite up high. ' +
  'Sam laughs and holds the string tight. The dog barks at the sky!';

export default function ReadingSettingsScreen() {
  const router = useRouter();
  const [childId, setChildId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReadingSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await getChosenChild();
      if (!id) {
        router.replace('/child-select');
        return;
      }
      setChildId(id);
      try {
        setDraft(await loadReadingSettings(id));
      } catch {
        setMessage('Could not load your settings. Showing the default ones.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const change = (part: Partial<ReadingSettings>) => {
    setDraft({ ...draft, ...part });
    setMessage('');
    setSaved(false);
  };

  // Reset only changes the choices on screen. SAVE stores them.
  const handleReset = () => change(DEFAULT_SETTINGS);

  const handleSave = async () => {
    if (saving || !childId) return;
    setSaving(true);
    setMessage('');
    try {
      await saveReadingSettings(childId, draft);
      setSaved(true);
      setMessage('Saved! Your reading is all set.');
    } catch {
      setSaved(false);
      setMessage('We could not save right now. Please check your internet and try again.');
    } finally {
      setSaving(false);
    }
  };

  const optionStyle = (selected: boolean) => ({ pressed }: { pressed: boolean }) => [
    styles.option,
    selected && styles.optionSelected,
    pressed && styles.pressed,
  ];

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

          {loading ? (
            <ActivityIndicator size="large" color={colors.orangeDark} style={styles.loader} />
          ) : (
            <>
              {/* Live preview */}
              <View style={styles.preview}>
                <Text style={styles.previewLabel}>PREVIEW</Text>
                <EasyReadText text={SAMPLE} settings={draft} />
              </View>

              {/* Font */}
              <Text style={styles.sectionTitle}>Font</Text>
              <View style={styles.row}>
                {FONT_OPTIONS.map((o) => (
                  <Pressable
                    key={o.value}
                    style={optionStyle(draft.font === o.value)}
                    onPress={() => change({ font: o.value })}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[styles.optionText, { fontFamily: o.family }]}
                    >
                      {o.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Text size */}
              <Text style={styles.sectionTitle}>Text size</Text>
              <View style={styles.row}>
                {SIZE_OPTIONS.map((size) => (
                  <Pressable
                    key={size}
                    style={optionStyle(draft.textSize === size)}
                    onPress={() => change({ textSize: size })}
                  >
                    <Text
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.2}
                      style={[styles.sizeSample, { fontSize: size }]}
                    >
                      Aa
                    </Text>
                    <Text numberOfLines={1} style={styles.optionSmall}>
                      {size}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Letter spacing */}
              <Text style={styles.sectionTitle}>Letter spacing</Text>
              <View style={styles.row}>
                {LETTER_OPTIONS.map((o) => (
                  <Pressable
                    key={o.value}
                    style={optionStyle(draft.letterSpacing === o.value)}
                    onPress={() => change({ letterSpacing: o.value })}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[styles.optionText, { letterSpacing: o.value }]}
                    >
                      abc
                    </Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={styles.optionSmall}>
                      {o.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Line spacing */}
              <Text style={styles.sectionTitle}>Line spacing</Text>
              <View style={styles.row}>
                {LINE_OPTIONS.map((value) => (
                  <Pressable
                    key={value}
                    style={optionStyle(draft.lineSpacing === value)}
                    onPress={() => change({ lineSpacing: value })}
                  >
                    <Ionicons name="reorder-three" size={24} color={colors.navy} />
                    <Text numberOfLines={1} style={styles.optionSmall}>
                      {value.toFixed(1)}×
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Reading speed (read aloud) */}
              <Text style={styles.sectionTitle}>Reading speed</Text>
              <View style={styles.row}>
                {SPEED_OPTIONS.map((o) => (
                  <Pressable
                    key={o.value}
                    style={optionStyle(draft.speechSpeed === o.value)}
                    onPress={() => change({ speechSpeed: o.value })}
                  >
                    <Text numberOfLines={1} adjustsFontSizeToFit style={styles.optionText}>
                      {o.label}
                    </Text>
                    <Text numberOfLines={1} style={styles.optionSmall}>
                      {o.note}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {message !== '' && (
                <View style={[styles.messageBox, !saved && styles.messageBoxError]}>
                  {saved && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.doctorGreen} />
                  )}
                  <Text style={[styles.messageText, !saved && styles.messageTextError]}>
                    {message}
                  </Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  saving && styles.buttonBusy,
                  pressed && !saving && styles.pressed,
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.buttonText}>{saving ? 'SAVING…' : 'SAVE'}</Text>
                {!saving && <Ionicons name="checkmark" size={22} color={colors.brown} />}
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
                onPress={handleReset}
                disabled={saving}
              >
                <Ionicons name="refresh" size={16} color={colors.navy} />
                <Text style={styles.resetText}>Reset to default</Text>
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
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
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
  titleWrap: { alignSelf: 'stretch', marginTop: 14, marginBottom: 16 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  loader: { marginVertical: 40 },
  preview: {
    backgroundColor: colors.cardCream,
    borderWidth: 2,
    borderColor: CARD_BORDER,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  previewLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.navy,
    marginTop: 20,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    flexGrow: 1,
    flexBasis: '22%',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.white,
    borderBottomWidth: 5,
    borderBottomColor: colors.whiteShadow,
  },
  optionSelected: {
    backgroundColor: colors.orange,
    borderColor: colors.yellow,
    borderBottomColor: colors.orangeDark,
  },
  optionText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.navy,
  },
  sizeSample: {
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  optionSmall: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.navy,
    marginTop: 2,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  messageBoxError: { borderColor: ERROR },
  messageText: {
    flexShrink: 1,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 22,
    color: colors.navy,
    textAlign: 'center',
  },
  messageTextError: { color: ERROR },
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
    marginTop: 22,
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.brown,
  },
  reset: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
  },
  resetText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.navy,
  },
});
