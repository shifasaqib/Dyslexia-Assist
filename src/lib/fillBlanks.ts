import { cleanWord } from './syllables';

/* =====================================================================
   FILL-IN-THE-BLANKS: QUESTION MAKER (our own logic, no AI, no API)

   Uses ONLY the page that was just scanned (the text on the Your Text screen).
   Nothing is made up:
   - 5 words are picked at random from the page (small easy words are skipped)
   - each question is the EXACT sentence from the page, with that word as a blank
   - the 2 wrong options are other real words from the same page
   ===================================================================== */

export const QUESTION_COUNT = 5;
const BLANK = '_____';
const MIN_WORD_LENGTH = 4; // shorter words (like "the", "and", "is") are too easy

// Small common words that are never used as questions or options
const EASY_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'been', 'before', 'came', 'come', 'could',
  'does', 'down', 'each', 'even', 'every', 'from', 'gave', 'give', 'goes', 'going', 'good',
  'have', 'here', 'into', 'just', 'know', 'like', 'look', 'made', 'make', 'many', 'more',
  'most', 'much', 'must', 'only', 'other', 'over', 'said', 'same', 'should', 'some', 'such',
  'take', 'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'thing', 'this',
  'those', 'very', 'want', 'were', 'what', 'when', 'where', 'which', 'while', 'will', 'with',
  'would', 'your', 'yours',
]);

// One question: the sentence is shown as  before + BLANK + after
export type Question = {
  word: string; // the correct answer
  sentence: string; // the exact sentence from the page (with the word)
  before: string; // sentence text before the blank
  after: string; // sentence text after the blank
  options: string[]; // 3 options (correct + 2 wrong), shuffled
};

export type Score = {
  correct: number;
  total: number;
  percent: number;
  wrongQuestions: Question[]; // the questions answered wrong
};

// Shuffle a list (Fisher-Yates)
const shuffle = <T,>(list: T[]): T[] => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// The page's sentences, copied exactly (they end at . ! ? or a new line)
const pageSentences = (text: string) =>
  (text.match(/[^.!?\n]+[.!?]*["”'’)\]]*/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => s !== '');

// The real words of a sentence (lowercase, no punctuation)
const wordsOf = (sentence: string) =>
  sentence
    .split(/\s+/)
    .map(cleanWord)
    .filter((w): w is string => w !== null);

// A word that is good for a question or an option
const usableWord = (w: string) =>
  w.length >= MIN_WORD_LENGTH && !EASY_WORDS.has(w) && /^[a-z][a-z'-]*$/.test(w);

// Replace the word with a blank in the exact sentence, keeping the punctuation around it.
// "...danger of extinction." -> before "...danger of ", after "."
const makeBlank = (sentence: string, word: string) => {
  for (const match of sentence.matchAll(/\S+/g)) {
    const token = match[0];
    if (cleanWord(token) !== word) continue;

    const parts = token.match(/^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/);
    const prefix = parts?.[1] ?? '';
    const suffix = parts?.[3] ?? '';
    const start = match.index ?? 0;
    return {
      before: sentence.slice(0, start) + prefix,
      after: suffix + sentence.slice(start + token.length),
    };
  }
  return null;
};

// 2 wrong options: real words from the same page, not visible in the question's sentence,
// with a length close to the answer (so it is not too easy)
const pickWrongOptions = (word: string, sentence: string, pageWords: string[]): string[] => {
  const inSentence = new Set(wordsOf(sentence));
  const candidates = pageWords.filter((w) => w !== word && !inSentence.has(w));
  const sorted = shuffle(candidates).sort(
    (a, b) => Math.abs(a.length - word.length) - Math.abs(b.length - word.length)
  );
  return shuffle(sorted.slice(0, 4)).slice(0, 2);
};

// Make up to 5 questions from the page that was just scanned
export function makePageQuestions(pageText: string): Question[] {
  const sentences = pageSentences(pageText);

  // Every usable word on the page (each word only once)
  const pageWords = [...new Set(sentences.flatMap(wordsOf).filter(usableWord))];

  // Random order of (word, sentence) pairs; prefer one question per sentence
  const pairs = shuffle(
    sentences.flatMap((sentence) =>
      [...new Set(wordsOf(sentence).filter(usableWord))].map((word) => ({ word, sentence }))
    )
  );
  const ordered = [
    ...pairs.filter((p, i) => pairs.findIndex((q) => q.sentence === p.sentence) === i),
    ...pairs,
  ];

  const questions: Question[] = [];
  const usedWords = new Set<string>();
  for (const { word, sentence } of ordered) {
    if (questions.length >= QUESTION_COUNT) break;
    if (usedWords.has(word)) continue;

    const blank = makeBlank(sentence, word);
    const wrong = pickWrongOptions(word, sentence, pageWords);
    if (!blank || wrong.length < 2) continue; // not enough real words: skip

    usedWords.add(word);
    questions.push({
      word,
      sentence,
      before: blank.before,
      after: blank.after,
      options: shuffle([word, ...wrong]),
    });
  }
  return questions;
}

// The full sentence with a blank, for showing on screen
export const questionText = (q: Question) => `${q.before}${BLANK}${q.after}`;

// Score the round. answers[i] = the option the child chose for questions[i]
export function scoreAnswers(questions: Question[], answers: (string | null)[]): Score {
  let correct = 0;
  const wrongQuestions: Question[] = [];
  questions.forEach((q, i) => {
    if (answers[i] === q.word) correct += 1;
    else wrongQuestions.push(q);
  });
  const total = questions.length;
  return {
    correct,
    total,
    percent: total > 0 ? Math.round((correct / total) * 100) : 0,
    wrongQuestions,
  };
}
