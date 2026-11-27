import { FunctionsHttpError } from '@supabase/supabase-js';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { supabase } from './supabase';

// Voice helper: reads text out loud. It has two voices:
//  - "azure":  Microsoft Azure's natural child voice, through our "tts" server function.
//              Azure sends the exact time of every word, so the highlight follows it.
//  - "device": the phone's own voice (Expo Speech). Free, works offline.
// Which one is used comes from .env:
//   EXPO_PUBLIC_TTS_ENGINE=azure   -> Azure voice (for the viva)
//   EXPO_PUBLIC_TTS_ENGINE=device  -> phone voice (daily testing). Also used if the line is missing.
// Automatic backup: if Azure fails or is too slow, the phone voice reads instead.
const ENGINE: 'azure' | 'device' =
  process.env.EXPO_PUBLIC_TTS_ENGINE === 'azure' ? 'azure' : 'device';

// How long we wait for Azure before using the phone voice instead
const AZURE_WAIT_MS = 20000;
const BACKUP_NOTE = 'Using phone voice.';

export type SpeechStatus = 'idle' | 'loading' | 'playing' | 'paused';

type ReadingCallbacks = {
  onStatus: (status: SpeechStatus) => void; // idle / loading / playing / paused changed
  // Something went wrong. message = a kind message to show (if the server sent one)
  onError?: (message?: string) => void;
  // Position (in the full text) of the word being spoken, or null when nothing is being read
  onWord?: (charIndex: number | null) => void;
  // A small note for the screen (e.g. "Using phone voice." when the backup is used)
  onNotice?: (message: string) => void;
};

/* =====================================================================
   SHARED STATE (only one reading at a time in the whole app)
   ===================================================================== */

let status: SpeechStatus = 'idle';
let rate = 1.0; // phone voice speed (0.25 / 0.5 / 0.75)
let speedLevel = 1; // Azure speed sent to the server (0 = -50%, 1 = -25%, 2 = 0%)
let playback = 1; // how fast the Azure audio is played (0.5 for Slow, pitch corrected)
let callbacks: ReadingCallbacks | null = null;
// Every start/stop gets a new number, so late events from an old reading are ignored
let session = 0;

const setStatus = (next: SpeechStatus) => {
  status = next;
  callbacks?.onStatus(next);
};

/* Special characters: symbols are spoken as words ("&" -> "and").
   The voices read the "spoken" text. spokenMap[i] = where letter i of the
   spoken text came from in the page text, so the highlight stays on the
   original symbol on screen. Punctuation (, . ! ? : ;) is not changed:
   the voices only pause at it. */
const SYMBOL_WORDS: Record<string, string> = {
  '@': 'at',
  '&': 'and',
  '#': 'hash',
  '%': 'percent',
  '+': 'plus',
  '=': 'equals',
  $: 'dollar',
  '/': 'slash',
  // Maths symbols
  '×': 'times',
  '✕': 'times', // multiply look-alikes from scanned pages
  '✖': 'times',
  '÷': 'divided by',
  '−': 'minus', // the real maths minus sign (not the normal dash)
  '±': 'plus or minus',
  '^': 'to the power of',
  '√': 'square root of',
  '<': 'less than',
  '>': 'greater than',
  '≤': 'less than or equal to',
  '≥': 'greater than or equal to',
  '≠': 'not equal to',
  ǂ: 'not equal to', // look-alike from scanned pages: "=" with a straight line through it
  '≈': 'approximately equal to',
  π: 'pi',
  '°': 'degrees',
  '½': 'one half',
  '¼': 'one quarter',
  '¾': 'three quarters',
};
let spokenMap: number[] = [];

// Any space counts, also the "non-breaking" spaces that scanned pages often have
const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);

// The nearest character before / after position i that is not a space
const charBefore = (text: string, i: number) => {
  let j = i - 1;
  while (j >= 0 && isSpace(text[j])) j -= 1;
  return j >= 0 ? text[j] : '';
};
const charAfter = (text: string, i: number) => {
  let j = i + 1;
  while (j < text.length && isSpace(text[j])) j += 1;
  return j < text.length ? text[j] : '';
};
const isDigit = (ch: string) => /\d/.test(ch);

// The normal dash and its look-alikes from scanned pages (en dash, em dash, figure dash, ...)
const DASHES = '-–—‒‑';

// Characters that are only maths in some places (so words like "well-known",
// ranges like "5-10" and words with "x" are never changed):
//  dash -> "minus" for "5 - 3" (spaces, numbers both sides) or "-5" (start of a word)
//  "*"  -> "times" between numbers ("5 * 3", "5*3")
//  "·"  -> "times" between numbers ("5 · 3")
//  "x"  -> "times" alone between numbers with spaces ("3 x 4")
const mathsWordAt = (text: string, i: number): string | null => {
  const ch = text[i];
  const betweenNumbers = isDigit(charBefore(text, i)) && isDigit(charAfter(text, i));
  const spacedNumbers = isSpace(text[i - 1]) && isSpace(text[i + 1]) && betweenNumbers;
  if (DASHES.includes(ch)) {
    if (spacedNumbers) return 'minus';
    if ((i === 0 || isSpace(text[i - 1]) || text[i - 1] === '(') && isDigit(text[i + 1] ?? '')) {
      return 'minus';
    }
  }
  if ((ch === '*' || ch === '·' || ch === '⋅') && betweenNumbers) return 'times';
  if ((ch === 'x' || ch === 'X') && spacedNumbers) return 'times';
  return null;
};

// Turn a number into English words (our own simple code):
// "20" -> "twenty", "1,200" -> "one thousand two hundred", "5.50" -> "five point five zero"
const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const underThousand = (n: number): string => {
  const words: string[] = [];
  if (n >= 100) {
    words.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    words.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ''));
  } else if (n > 0) {
    words.push(ONES[n]);
  }
  return words.join(' ');
};

export function numberToWords(number: string): string {
  const [whole, decimals] = number.replace(/,/g, '').split('.');
  let n = Number(whole);
  if (!Number.isFinite(n) || whole.length > 12) return number; // too big: leave as it is
  const parts: string[] = [];
  for (const [size, name] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] as const) {
    if (n >= size) {
      parts.push(`${underThousand(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n > 0 || parts.length === 0) parts.push(n === 0 ? 'zero' : underThousand(n));
  let result = parts.join(' ');
  if (decimals) result += ' point ' + [...decimals].map((d) => ONES[Number(d)]).join(' ');
  return result;
}

// The "plain" form of a special character from a scanned page,
// e.g. a maths-font pi "𝜋" -> "π". If the phone cannot do it, keep the character.
const plainForm = (ch: string) => {
  try {
    return ch.normalize('NFKC');
  } catch {
    return ch;
  }
};

// Marks that are drawn ON TOP of the character before them (invisible on their own)
export const OVERLAY_MARK = /[̀-ͯ⃐-⃿]/;

export function toSpokenText(text: string): { spoken: string; map: number[] } {
  let spoken = '';
  const map: number[] = [];
  // Every spoken letter remembers where it came from in the page text (for the highlight)
  const add = (piece: string, from: number) => {
    for (let k = 0; k < piece.length; k++) {
      spoken += piece[k];
      map.push(from);
    }
  };

  let i = 0;
  while (i < text.length) {
    // One character (some special ones, like a maths-font pi, use 2 places in the text)
    const ch = String.fromCodePoint(text.codePointAt(i) ?? 0);
    const next = i + ch.length;

    // "$" + number: say "dollar" + the number in words, so the voice keeps the
    // written order ("dollar twenty") and cannot change it to "twenty dollars"
    if (ch === '$') {
      const money = /^\d+(,\d{3})*(\.\d+)?/.exec(text.slice(next));
      if (money) {
        add(` dollar ${numberToWords(money[0])} `, i); // all point back to the "$"
        i = next + money[0].length;
        continue;
      }
    }

    // "≠" written in two parts: "=" + an overlay mark drawn on top of it
    // (slash or straight line, e.g. U+0338, U+20D2, U+20D3), or typed as "=/="
    if (ch === '=' && OVERLAY_MARK.test(text[next] ?? '')) {
      add(' not equal to ', i);
      i = next + 1;
      continue;
    }
    if (text.startsWith('=/=', i)) {
      add(' not equal to ', i);
      i += 3;
      continue;
    }

    // A scanned square root sign often comes as the letter "V" or "v" right before
    // a number at the start of a word ("V16" -> "square root of 16")
    if ((ch === 'V' || ch === 'v') && (i === 0 || isSpace(text[i - 1]) || text[i - 1] === '(')) {
      if (isDigit(text[next] ?? '')) {
        add(' square root of ', i);
        i = next;
        continue;
      }
    }

    const word = SYMBOL_WORDS[ch] ?? SYMBOL_WORDS[plainForm(ch)] ?? mathsWordAt(text, i);
    add(word ? ` ${word} ` : ch, i);
    i = next;
  }
  return { spoken, map };
}

// Tell the screen which word is being spoken (position in the ORIGINAL page text)
const reportWord = (charIndex: number | null) =>
  callbacks?.onWord?.(charIndex === null ? null : (spokenMap[charIndex] ?? charIndex));

// Play the Azure audio slower (0.5 for Slow). The pitch stays normal (no deep voice).
// The highlight follows the audio position, so it stays in sync by itself.
const applyPlayback = (audio: AudioPlayer, value: number) => {
  if (value === 1) return;
  try {
    audio.setPlaybackRate(value, 'high');
  } catch (e) {
    console.log('Playback speed not set:', e);
  }
};

/* =====================================================================
   1. PHONE VOICE (Expo Speech)
   Reads ONE SENTENCE AT A TIME, because phones limit how much text can be
   spoken in one go. Android has no real "pause" (only stop), so the app
   remembers the WORD being spoken and Play continues from that word.
   ===================================================================== */

// A sentence and where it starts in the full text
type Sentence = { text: string; start: number };

// Longest piece we send to the phone voice in one go (safe for all phones)
const MAX_PIECE = 1000;

// Split the text into sentences (ending with . ! ? or a new line)
const splitSentences = (text: string): Sentence[] => {
  const result: Sentence[] = [];
  const pattern = /[^.!?\n]+[.!?]*/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const raw = match[0];
    const lead = raw.length - raw.trimStart().length;
    let piece = raw.trim();
    let start = match.index + lead;

    // Very long sentence: cut it at a space so the phone can speak it
    while (piece.length > MAX_PIECE) {
      const cut = piece.lastIndexOf(' ', MAX_PIECE);
      const end = cut > 0 ? cut : MAX_PIECE;
      result.push({ text: piece.slice(0, end), start });
      const rest = piece.slice(end);
      const restLead = rest.length - rest.trimStart().length;
      start += end + restLead;
      piece = rest.trim();
    }
    if (piece !== '') result.push({ text: piece, start });
  }
  return result;
};

let sentences: Sentence[] = [];
let index = 0;
// Where to start inside the current sentence (0 = its first word; after Pause = the paused word)
let startOffset = 0;
// Start of the word the voice is saying right now (inside the current sentence)
let currentWordOffset = 0;

// Go back to the very beginning of the text
const resetPlace = () => {
  index = 0;
  startOffset = 0;
  currentWordOffset = 0;
};

/* Backup for phones that do not send word signals:
   guess when each word starts from how long the words are.
   As soon as a real word signal arrives, the guessing stops. */
const CHARS_PER_SECOND = 14; // normal speaking speed, about 14 letters a second
let guessTimer: ReturnType<typeof setTimeout> | null = null;

const stopGuessing = () => {
  if (guessTimer) clearTimeout(guessTimer);
  guessTimer = null;
};

const startGuessing = (mySession: number, sentence: Sentence, offset: number) => {
  stopGuessing();
  const piece = sentence.text.slice(offset);
  const words = [...piece.matchAll(/\S+/g)];
  let i = 0;

  const next = () => {
    if (mySession !== session || i >= words.length) return;
    const word = words[i];
    currentWordOffset = offset + (word.index ?? 0);
    reportWord(sentence.start + currentWordOffset);
    i += 1;
    const seconds = (word[0].length + 1) / (CHARS_PER_SECOND * rate);
    guessTimer = setTimeout(next, seconds * 1000);
  };
  next();
};

const speakCurrent = () => {
  const mySession = session;
  const sentence = sentences[index];

  // No more sentences: reading is finished
  if (!sentence) {
    finishReading();
    return;
  }

  // Speak from the remembered word to the end of the sentence
  const offset = startOffset;
  currentWordOffset = offset;
  const piece = sentence.text.slice(offset);
  let gotWordSignal = false;

  // Highlight the first word straight away
  reportWord(sentence.start + offset);

  // The phone tells us when each word starts (charIndex is inside "piece")
  const onBoundary = (event: { charIndex: number }) => {
    if (mySession !== session) return;
    gotWordSignal = true;
    stopGuessing();
    currentWordOffset = offset + event.charIndex;
    reportWord(sentence.start + currentWordOffset);
  };

  Speech.speak(piece, {
    rate,
    onBoundary: onBoundary as Speech.SpeechOptions['onBoundary'],
    onStart: () => {
      if (mySession !== session) return;
      // Give the phone a moment to send its first word signal; if none comes, guess
      guessTimer = setTimeout(() => {
        if (mySession === session && !gotWordSignal) startGuessing(mySession, sentence, offset);
      }, 400);
    },
    onDone: () => {
      if (mySession !== session || status !== 'playing') return;
      stopGuessing();
      index += 1;
      startOffset = 0;
      speakCurrent();
    },
    onError: () => {
      if (mySession !== session) return;
      failReading();
    },
  });
};

const deviceStart = (text: string) => {
  sentences = splitSentences(text);
  resetPlace();
  if (sentences.length === 0) return;
  setStatus('playing');
  speakCurrent();
};

const devicePause = () => {
  session += 1; // ignore the "done" event of the sentence we are cutting off
  stopGuessing();
  startOffset = currentWordOffset;
  setStatus('paused');
  Speech.stop();
};

const deviceResume = () => {
  session += 1;
  setStatus('playing');
  speakCurrent();
};

const deviceStop = () => {
  stopGuessing();
  resetPlace();
  Speech.stop();
};

/* =====================================================================
   2. AZURE VOICE (through our "tts" server function)
   The server sends a 1-hour audio link + the start time of every word.
   While the audio plays, we check the time ~10 times a second and
   highlight the word whose start time has been reached.
   ===================================================================== */

const NOT_ANSWERING = 'The reading voice is not answering. Please try again.';

type AzureWord = { word: string; startMs: number };
type TimedWord = { charIndex: number; startMs: number };

let player: AudioPlayer | null = null;
let timedWords: TimedWord[] = [];
let tickTimer: ReturnType<typeof setInterval> | null = null;
let lastShown = -1;
let audioModeReady = false;

// Find where each Azure word is in the page text (in order), so we can highlight it there
const placeWords = (text: string, words: AzureWord[]): TimedWord[] => {
  const lower = text.toLowerCase();
  const placed: TimedWord[] = [];
  let cursor = 0;

  for (const w of words) {
    const word = (w.word ?? '').trim().toLowerCase();
    if (word === '') continue;

    // Next place where the word starts (not in the middle of another word)
    let at = lower.indexOf(word, cursor);
    while (at > 0 && /[a-z0-9]/.test(lower[at - 1])) {
      at = lower.indexOf(word, at + 1);
    }
    // Not found close by: skip this word, keep going
    if (at === -1 || at - cursor > 200) continue;

    placed.push({ charIndex: at, startMs: w.startMs });
    cursor = at + word.length;
  }
  return placed;
};

const stopTicking = () => {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
};

// ~10 times a second: which word has the audio reached?
const startTicking = (mySession: number) => {
  stopTicking();
  tickTimer = setInterval(() => {
    if (mySession !== session || !player) return;
    const nowMs = player.currentTime * 1000;
    let i = Math.max(lastShown, 0);
    while (i + 1 < timedWords.length && timedWords[i + 1].startMs <= nowMs) i += 1;
    if (timedWords.length > 0 && timedWords[i].startMs <= nowMs && i !== lastShown) {
      lastShown = i;
      reportWord(timedWords[i].charIndex);
    }
  }, 100);
};

const removePlayer = () => {
  stopTicking();
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {
      // already removed
    }
  }
  player = null;
  timedWords = [];
  lastShown = -1;
};

// Read the kind message our server sent (e.g. "Please log in first.")
const serverMessage = async (error: unknown) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const details = await error.context.json();
      if (typeof details?.error === 'string') return details.error as string;
    } catch {
      // keep the default message
    }
  }
  return NOT_ANSWERING;
};

// Automatic backup: Azure did not work, so the phone voice reads the same text
const useBackupVoice = (text: string, reason: string) => {
  console.log('Azure voice not used:', reason);
  removePlayer();
  callbacks?.onNotice?.(BACKUP_NOTE);
  deviceStart(text);
};

// Ask our "tts" server function, but give up after AZURE_WAIT_MS
const askServer = (text: string) =>
  Promise.race([
    supabase.functions.invoke('tts', { body: { text, speed: speedLevel } }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Azure took too long')), AZURE_WAIT_MS)
    ),
  ]);

const azureStart = async (text: string) => {
  const mySession = session;
  setStatus('loading');

  try {
    // Play even when an iPhone is on silent mode
    if (!audioModeReady) {
      await setAudioModeAsync({ playsInSilentMode: true });
      audioModeReady = true;
    }

    const { data, error } = await askServer(text);
    if (mySession !== session) return; // stopped while loading

    if (error) {
      useBackupVoice(text, await serverMessage(error));
      return;
    }
    if (typeof data?.audioUrl !== 'string') {
      useBackupVoice(text, 'no audio link came back');
      return;
    }

    timedWords = placeWords(text, Array.isArray(data.words) ? data.words : []);
    lastShown = -1;

    player = createAudioPlayer({ uri: data.audioUrl }, { updateInterval: 100 });
    player.addListener('playbackStatusUpdate', (playback) => {
      if (mySession !== session) return;
      if (playback.didJustFinish) finishReading();
    });
    player.play();
    applyPlayback(player, playback);
    setStatus('playing');
    startTicking(mySession);
  } catch (e) {
    if (mySession === session) useBackupVoice(text, String(e));
  }
};

const azurePause = () => {
  stopTicking();
  player?.pause();
  setStatus('paused');
};

const azureResume = () => {
  if (!player) return;
  player.play();
  applyPlayback(player, playback); // some phones reset the speed on play
  setStatus('playing');
  startTicking(session);
};

/* =====================================================================
   3. WHAT THE SCREEN USES
   ===================================================================== */

// Reading reached the end
const finishReading = () => {
  session += 1;
  stopGuessing();
  resetPlace();
  removePlayer();
  reportWord(null);
  setStatus('idle');
};

// Something went wrong: stop and tell the screen
const failReading = (message?: string) => {
  finishReading();
  callbacks?.onError?.(message);
};

// Start reading this text from the beginning
export function startReading(
  text: string,
  readingCallbacks: ReadingCallbacks,
  options?: { rate?: number; speed?: 0 | 1 | 2; playbackRate?: number }
) {
  stopReading();
  callbacks = readingCallbacks;
  rate = options?.rate ?? 1.0;
  speedLevel = options?.speed ?? 1;
  playback = options?.playbackRate ?? 1;
  session += 1;

  // Read the "spoken" text (symbols as words); the highlight maps back to the page text
  const { spoken, map } = toSpokenText(text);
  spokenMap = map;

  if (ENGINE === 'azure') {
    azureStart(spoken);
  } else {
    deviceStart(spoken);
  }
}

// Pause: remember the place
export function pauseReading() {
  if (status !== 'playing') return;
  if (player) {
    azurePause();
  } else {
    devicePause();
  }
}

// Play again from the remembered place
export function resumeReading() {
  if (status !== 'paused') return;
  if (player) {
    azureResume();
  } else {
    deviceResume();
  }
}

// Stop completely and go back to the start
export function stopReading() {
  session += 1;
  deviceStop();
  removePlayer();
  const wasActive = status !== 'idle';
  status = 'idle';
  if (wasActive) {
    reportWord(null);
    callbacks?.onStatus('idle');
  }
}

/* =====================================================================
   4. SAY ONE WORD (the 🔊 button in the syllable popup)
   Completely separate from the page reading: it has its own player and
   never stops, resets or changes the page reading.
   Azure first (Slow), phone voice if Azure fails or takes over 3 seconds.
   ===================================================================== */

const WORD_AZURE_WAIT_MS = 3000;
let wordTry = 0; // every new word (or stop) gets a new number, late answers are ignored
let wordPlayer: AudioPlayer | null = null;
let wordOnPhone = false; // true while the phone voice is saying the word

const stopWordVoice = () => {
  if (wordPlayer) {
    try {
      wordPlayer.pause();
      wordPlayer.remove();
    } catch {
      // already removed
    }
    wordPlayer = null;
  }
  if (wordOnPhone) {
    wordOnPhone = false;
    Speech.stop();
  }
};

// Say one word slowly. Returns stop(): call it to stop this word's voice.
// rate = phone voice speed; azureSpeed + playbackRate = Azure speed and how fast it is played.
export function speakWord(
  word: string,
  options: {
    rate: number;
    azureSpeed?: 0 | 1 | 2;
    playbackRate?: number;
    onLoading?: (loading: boolean) => void;
  }
): () => void {
  stopWordVoice();
  wordTry += 1;
  const myTry = wordTry;

  const loading = (value: boolean) => {
    try {
      options.onLoading?.(value);
    } catch {
      // the popup may already be closed
    }
  };

  // Phone voice (backup, or when the switch says "device")
  const phoneVoice = () => {
    if (myTry !== wordTry) return;
    loading(false);
    try {
      wordOnPhone = true;
      Speech.speak(word, {
        rate: options.rate,
        onDone: () => {
          if (myTry === wordTry) wordOnPhone = false;
        },
        onError: () => {
          if (myTry === wordTry) wordOnPhone = false;
        },
      });
    } catch (e) {
      wordOnPhone = false;
      console.log('Word voice failed:', e);
    }
  };

  const stop = () => {
    if (myTry !== wordTry) return; // a newer word already took over
    wordTry += 1;
    loading(false);
    stopWordVoice();
  };

  if (ENGINE !== 'azure') {
    phoneVoice();
    return stop;
  }

  loading(true);
  (async () => {
    try {
      // Play even when an iPhone is on silent mode (same setup as the page reading)
      if (!audioModeReady) {
        await setAudioModeAsync({ playsInSilentMode: true });
        audioModeReady = true;
      }

      const { data, error } = await Promise.race([
        supabase.functions.invoke('tts', { body: { text: word, speed: options.azureSpeed ?? 0 } }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Azure took too long')), WORD_AZURE_WAIT_MS)
        ),
      ]);
      if (myTry !== wordTry) return; // stopped or a newer word while loading

      if (error || typeof data?.audioUrl !== 'string') {
        phoneVoice();
        return;
      }

      loading(false);
      const player = createAudioPlayer({ uri: data.audioUrl });
      wordPlayer = player;
      player.addListener('playbackStatusUpdate', (playback) => {
        if (playback.didJustFinish && wordPlayer === player) stopWordVoice();
      });
      player.play();
      applyPlayback(player, options.playbackRate ?? 1);
    } catch (e) {
      console.log('Azure word voice not used:', String(e));
      phoneVoice();
    }
  })();

  return stop;
}
