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
};
