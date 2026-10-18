// Pure helpers for review sessions (tested in src/test/vocab.test.ts).

export type Word = { id: string; german: string; french: string };
export type Progress = {
  word_id: string;
  due_at: string;
  repetitions: number;
  wrong_count: number;
  correct_count: number;
};

/** Normalise a typed German answer: case, spaces, umlaut spellings (ae→ä…), ß/ss. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/ae/g, "ä")
    .replace(/oe/g, "ö")
    .replace(/ue/g, "ü")
    .replace(/ß/g, "ss");
}

export function isAnswerCorrect(typed: string, expected: string): boolean {
  if (!typed.trim()) return false;
  // Teachers may store alternatives separated by "/" (e.g. "der Junge / der Knabe").
  const options = expected.split("/").map((o) => normalizeAnswer(o));
  return options.includes(normalizeAnswer(typed));
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i] as T;
    a[i] = a[j] as T;
    a[j] = t;
  }
  return a;
}

/** Four French options (one correct) drawn from the same list. */
export function buildChoices(target: Word, pool: Word[], rng: () => number = Math.random): string[] {
  const others = Array.from(
    new Set(pool.filter((w) => w.id !== target.id && w.french !== target.french).map((w) => w.french)),
  );
  const distractors = shuffle(others, rng).slice(0, 3);
  return shuffle([target.french, ...distractors], rng);
}

/**
 * Words to review now: new words and words whose due date has passed,
 * most overdue / most often missed first. If nothing is due, returns every
 * word ordered by due date (free practice) with caughtUp = true.
 */
export function orderQueue(
  words: Word[],
  progress: Progress[],
  now: Date,
  limit = 15,
): { queue: Word[]; caughtUp: boolean } {
  const map = new Map(progress.map((p) => [p.word_id, p]));
  const scored = words.map((w) => {
    const p = map.get(w.id);
    const due = p ? new Date(p.due_at).getTime() : 0;
    return { w, p, due };
  });
  const dueNow = scored
    .filter((s) => !s.p || s.due <= now.getTime())
    .sort((a, b) => {
      // Previously missed words first, then most overdue, new words after.
      const wa = a.p ? a.p.wrong_count - a.p.correct_count : -Infinity;
      const wb = b.p ? b.p.wrong_count - b.p.correct_count : -Infinity;
      if (a.p && b.p && wa !== wb) return wb - wa;
      if (!!a.p !== !!b.p) return a.p ? -1 : 1;
      return a.due - b.due;
    });
  if (dueNow.length > 0) return { queue: dueNow.slice(0, limit).map((s) => s.w), caughtUp: false };
  return {
    queue: [...scored].sort((a, b) => a.due - b.due).slice(0, limit).map((s) => s.w),
    caughtUp: true,
  };
}

export const MODE_LABELS: Record<string, string> = {
  flashcard: "Cartes",
  choice: "QCM",
  typing: "Écriture",
  context: "Phrase",
};

export type ErrorType = "article" | "spelling" | "translation";
export const ERROR_LABELS: Record<string, string> = {
  article: "Erreur d'article (der / die / das)",
  spelling: "Erreur d'orthographe",
  translation: "Erreur de traduction",
  context: "Erreur d'emploi dans la phrase",
};

const ARTICLES = ["der", "die", "das"];

function splitArticle(s: string): { article: string | null; noun: string } {
  const n = normalizeAnswer(s);
  const [first, ...rest] = n.split(" ");
  if (first && ARTICLES.includes(first) && rest.length) return { article: first, noun: rest.join(" ") };
  return { article: null, noun: n };
}

function levenshtein(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}

/** Classify a wrong typed German answer. Returns null when the answer is correct. */
export function diagnoseAnswer(typed: string, expected: string): ErrorType | null {
  if (isAnswerCorrect(typed, expected)) return null;
  let best: ErrorType = "translation";
  for (const opt of expected.split("/")) {
    const e = splitArticle(opt);
    const t = splitArticle(typed);
    if (e.article && t.noun === e.noun && t.article !== e.article) return "article";
    const dist = levenshtein(t.noun, e.noun);
    if (dist > 0 && dist <= (e.noun.length > 7 ? 2 : 1)) best = "spelling";
  }
  return best;
}

export type SkillRow = { word_id: string; skill: string; step: number };

/** A word is mastered only when written German AND recognition/translation are solid (step ≥ 3). */
export function isMastered(skills: SkillRow[]): boolean {
  const step = (k: string) => skills.find((s) => s.skill === k)?.step ?? 0;
  return step("writing") >= 3 && Math.max(step("recognition"), step("translation")) >= 3;
}

export const SKILL_LABELS: Record<string, string> = {
  recognition: "Reconnaissance",
  translation: "Traduction",
  writing: "Écriture",
  context: "En contexte",
};
