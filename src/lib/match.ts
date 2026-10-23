export type MatchWord = { id: string; german: string; french: string };
export const WAVE_SIZE = 6;

function shuffle<T>(a: T[], rand: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [r[i], r[j]] = [r[j] as T, r[i] as T]; }
  return r;
}

/** Split the whole list into full waves of 6; the last short wave is padded with already-seen words. */
export function buildWaves(words: MatchWord[], rand = Math.random, size = WAVE_SIZE): MatchWord[][] {
  const order = shuffle(words, rand);
  const waves: MatchWord[][] = [];
  for (let i = 0; i < order.length; i += size) waves.push(order.slice(i, i + size));
  const last = waves[waves.length - 1];
  if (last && waves.length > 1 && last.length < size) {
    const ids = new Set(last.map((w) => w.id));
    const fill = shuffle(order.filter((w) => !ids.has(w.id)), rand).slice(0, size - last.length);
    waves[waves.length - 1] = [...last, ...fill];
  }
  return waves;
}

export type Card = { key: string; wordId: string; text: string; side: "de" | "fr" };

/** All 12 cards of a wave are shuffled together, so no pair sits side by side by design. */
export function waveCards(wave: MatchWord[], rand = Math.random): Card[] {
  return shuffle(wave.flatMap((w) => [
    { key: `${w.id}-de`, wordId: w.id, text: w.german, side: "de" as const },
    { key: `${w.id}-fr`, wordId: w.id, text: w.french, side: "fr" as const },
  ]), rand);
}

/** Longest run of correct matches without a mistake. */
export function bestRun(results: boolean[]): number {
  let best = 0, cur = 0;
  for (const ok of results) { cur = ok ? cur + 1 : 0; best = Math.max(best, cur); }
  return best;
}
