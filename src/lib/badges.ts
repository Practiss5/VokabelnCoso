/** Student badges, computed from the student's own saved answers (no extra storage). */
import { computeStreak } from "@/lib/vocab";

export type BadgeReview = { word_id: string; created_at: string; mode: string; correct: boolean; error_type: string | null };
export type BadgeInput = {
  reviews: BadgeReview[];
  germanById: Map<string, string>;
  /** Number of homeworks already finished at least 24 h before their deadline. */
  earlyHomeworks: number;
  bestTetris: number;
  bestMatchRun: number;
  now?: Date;
};
export type Badge = { id: string; icon: string; name: string; rule: string; level: number; levels: number[]; value: number };

export const TETRIS_GOAL = 1500;
export const MATCH_GOAL = 15;
const SESSION_GAP = 10 * 60 * 1000;
const WRITTEN = new Set(["typing"]);
const LISTEN = new Set(["listen_de_fr", "listen_fr_de", "listen", "dictation"]);
const CHOICE = new Set(["choice", "choice_de_fr", "choice_fr_de"]);

const isNoun = (g: string) => /^(der|die|das)\s/i.test(g.trim());
const hasUmlaut = (g: string) => /[äöüß]/i.test(g);
/** Long compound noun: the noun itself (without article / plural) has at least 12 letters. */
const isCompound = (g: string) => {
  const m = g.trim().match(/^(der|die|das)\s+([^\s,(]+)/i);
  return Boolean(m && m[2]!.replace(/[^\p{L}]/gu, "").length >= 12);
};

/** Longest run of consecutive items matching `ok` among those matching `inScope`. */
function bestRun<T>(items: T[], inScope: (x: T) => boolean, ok: (x: T) => boolean): number {
  let best = 0, cur = 0;
  for (const x of items) { if (!inScope(x)) continue; cur = ok(x) ? cur + 1 : 0; best = Math.max(best, cur); }
  return best;
}

/** Splits answers into sittings: a pause of more than 10 minutes starts a new session. */
export function sessions(reviews: BadgeReview[]): BadgeReview[][] {
  const out: BadgeReview[][] = [];
  let last = -Infinity;
  for (const r of reviews) {
    const t = new Date(r.created_at).getTime();
    if (t - last > SESSION_GAP || !out.length) out.push([]);
    out[out.length - 1]!.push(r);
    last = t;
  }
  return out;
}

export function computeBadges(input: BadgeInput): Badge[] {
  const rv = [...input.reviews].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const g = (r: BadgeReview) => input.germanById.get(r.word_id) ?? "";
  const streak = computeStreak(rv.map((r) => r.created_at), input.now ?? new Date()).days;

  // Tenace: a word missed, then got right on the next try.
  let tenace = 0;
  const lastByWord = new Map<string, boolean>();
  for (const r of rv) { if (r.correct && lastByWord.get(r.word_id) === false) tenace++; lastByWord.set(r.word_id, r.correct); }

  const genres = bestRun(rv, (r) => (WRITTEN.has(r.mode) || r.mode === "speaking" || r.mode === "context") && isNoun(g(r)), (r) => r.error_type !== "article" && r.correct);
  const umlaut = rv.filter((r) => WRITTEN.has(r.mode) && r.correct && hasUmlaut(g(r))).length;
  const compound = rv.filter((r) => WRITTEN.has(r.mode) && r.correct && isCompound(g(r))).length;
  const ear = bestRun(rv, (r) => LISTEN.has(r.mode), (r) => r.correct);

  const firstSpoken = new Map<string, boolean>();
  for (const r of rv) if (r.mode === "speaking" && !firstSpoken.has(r.word_id)) firstSpoken.set(r.word_id, r.correct);
  const polyglot = [...firstSpoken.values()].filter(Boolean).length;

  // Sprint: 10 QCM answers in a row, all right, within 25 seconds.
  const qcm = rv.filter((r) => CHOICE.has(r.mode));
  let sprint = 0;
  for (let i = 0; i + 9 < qcm.length; i++) {
    const w = qcm.slice(i, i + 10);
    if (w.every((r) => r.correct) && new Date(w[9]!.created_at).getTime() - new Date(w[0]!.created_at).getTime() <= 25000) { sprint = 1; break; }
  }

  const ss = sessions(rv);
  const perfect = ss.filter((s) => s.length >= 20 && s.every((r) => r.correct)).length;
  const writing = ss.map((s) => s.filter((r) => WRITTEN.has(r.mode))).filter((s) => s.length >= 10 && s.length === ss.find((x) => x.includes(s[0]!))!.length && s.every((r) => r.correct)).length;
  const game = input.bestTetris >= TETRIS_GOAL || input.bestMatchRun >= MATCH_GOAL ? 1 : 0;

  const mk = (id: string, icon: string, name: string, rule: string, levels: number[], value: number): Badge =>
    ({ id, icon, name, rule, levels, value, level: levels.filter((l) => value >= l).length });
  return [
    mk("streak", "🔥", "Flamme du jour", "Série de 3, 5 puis 10 jours d'affilée", [3, 5, 10], streak),
    mk("early", "⏰", "Ponctuel", "Finir un devoir au moins 24 h avant l'échéance", [1], input.earlyHomeworks),
    mk("tenace", "🛡️", "Tenace", "Réussir un mot au 2e essai après l'avoir raté", [1], tenace),
    mk("century", "💯", "Le Centenaire", "Réviser 100, 500, 1000 puis 2000 mots", [100, 500, 1000, 2000], rv.length),
    mk("gender", "👑", "Maître des genres", "30 noms d'affilée sans erreur d'article", [30], genres),
    mk("umlaut", "🎯", "Chasseur d'Umlaut", "Écrire sans faute 50 mots avec ä, ö, ü ou ß", [50], umlaut),
    mk("compound", "🧱", "Bâtisseur de mots", "Écrire sans faute 40 mots composés longs", [40], compound),
    mk("ear", "🎧", "Oreille d'or", "20 réponses d'écoute justes d'affilée", [20], ear),
    mk("polyglot", "🎙️", "Polyglotte en herbe", "Prononcer 10 mots justes du premier coup", [10], polyglot),
    mk("sprint", "⚡", "Sprint éclair", "10 QCM justes d'affilée en moins de 25 s", [1], sprint),
    mk("perfect", "💎", "Zéro faute", "Une séance d'au moins 20 mots sans faute", [1], perfect),
    mk("pen", "✍️", "Plume d'or", "Une séance d'écriture (10 mots min.) sans faute", [1], writing),
    mk("game", "🧩", "As du Tetris", `${TETRIS_GOAL} points au Wort-Tetris ou ${MATCH_GOAL} paires d'affilée au jeu d'association`, [1], game),
  ];
}
