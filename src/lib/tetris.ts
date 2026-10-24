// Wort-Tetris: pure game rules (scoring, combos, bonuses, boss and word picking).

export type TWord = { id: string; german: string; french: string; listTitle?: string | undefined; foreign?: boolean };
export type TLevel = 1 | 2 | 3;
export const LEVEL_NAMES: Record<TLevel, string> = { 1: "Traduction", 2: "Prononciation", 3: "Orthographe" };
export const LEVEL_SKILL: Record<TLevel, string> = { 1: "translation", 2: "speaking", 3: "writing" };
export const WORDS_PER_LEVEL = 10;
export const BOSS_SIZE = 5;
export const COMBO_TARGET = 5;
export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const SLOW_MS = 5000;
export const COMBO_BONUS_MS = 30000;
/** Bonus unlocks, shown to the student. */
export const SLOW_EVERY = 6; // correct answers
export const COMBO_BONUS_EVERY = 12; // correct answers
export const LIFE_BOSS_MIN = 3; // boss hits needed for +1 life

export function basePoints(level: TLevel, boss: boolean) {
  return 10 * level * (boss ? 2 : 1);
}

export type ComboState = { streak: number; ready: boolean };
export const COMBO_START: ComboState = { streak: 0, ready: false };

/**
 * One answer. 5 consecutive successes arm a ×2 for the NEXT word only; the counter then restarts.
 * The 30 s combo bonus also doubles, but both together still give ×2 (never ×4).
 */
export function applyAnswer(c: ComboState, correct: boolean, base: number, comboBonusActive: boolean) {
  if (!correct) return { combo: COMBO_START, points: 0, doubled: false, armed: false };
  const doubled = c.ready || comboBonusActive;
  const points = doubled ? base * 2 : base;
  if (c.ready) return { combo: COMBO_START, points, doubled, armed: false };
  const streak = c.streak + 1;
  if (streak >= COMBO_TARGET) return { combo: { streak: 0, ready: true }, points, doubled, armed: true };
  return { combo: { streak, ready: false }, points, doubled, armed: false };
}

export const addLife = (lives: number) => Math.min(MAX_LIVES, lives + 1);

/** Fall duration of a brick (ms): faster as the game goes on, never below a floor. Writing gets more time. */
export function fallDuration(level: TLevel, answered: number, boss: boolean) {
  const base = level === 1 ? 9000 : level === 2 ? 12000 : 15000;
  const d = base * Math.pow(0.95, answered) * (boss ? 0.85 : 1);
  return Math.max(level === 1 ? 4000 : 6000, Math.round(d));
}

export type SkillStat = { word_id: string; skill: string; wrong_count: number; correct_count: number; step: number; last_error?: string | null };

/** Difficulty: past errors weigh most, recent last_error adds, successes and step lower it. */
export function difficulty(stats: SkillStat[]) {
  return stats.reduce((s, p) => s + p.wrong_count * 2 + (p.last_error ? 1 : 0) - p.correct_count * 0.5 - p.step * 0.5, 0);
}

/** Boss: hardest words of the student (real stats), then words missed in this game, then least tested. */
export function pickBoss(words: TWord[], stats: SkillStat[], missedNow: string[], size = BOSS_SIZE): TWord[] {
  const by = new Map<string, SkillStat[]>();
  for (const s of stats) by.set(s.word_id, [...(by.get(s.word_id) ?? []), s]);
  const scored = words.map((w) => {
    const st = by.get(w.id) ?? [];
    const tested = st.reduce((n, s) => n + s.wrong_count + s.correct_count, 0);
    const missed = missedNow.includes(w.id) ? 1 : 0;
    const d = difficulty(st);
    return { w, hard: d > 0 ? 2 : missed ? 1 : 0, d: d + missed * 3, tested };
  });
  scored.sort((a, b) => b.hard - a.hard || b.d - a.d || a.tested - b.tested);
  return scored.slice(0, size).map((s) => s.w);
}

/** Next word: chosen list first; after `mixAfter` answers, mastered words of other lists come back sometimes. */
export function pickNext(main: TWord[], others: TWord[], recent: string[], answered: number, rand = Math.random, mixAfter = 8): TWord | null {
  const fresh = (a: TWord[]) => a.filter((w) => !recent.includes(w.id));
  const useOther = others.length > 0 && answered >= mixAfter && rand() < Math.min(0.4, 0.15 + (answered - mixAfter) * 0.02);
  const pool = fresh(useOther ? others : main);
  const fallback = fresh(main).length ? fresh(main) : main;
  const src = pool.length ? pool : fallback;
  if (!src.length) return null;
  return src[Math.floor(rand() * src.length)] ?? null;
}

/** Three French options (one correct), distractors with a different meaning. */
export function threeChoices(target: TWord, pool: TWord[], rand = Math.random): string[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const others = Array.from(new Set(pool.filter((w) => w.id !== target.id && norm(w.french) !== norm(target.french)).map((w) => w.french)));
  const sh = <T,>(a: T[]) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [r[i], r[j]] = [r[j] as T, r[i] as T]; } return r; };
  return sh([target.french, ...sh(others).slice(0, 2)]);
}
