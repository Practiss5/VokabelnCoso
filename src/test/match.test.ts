import { describe, expect, it } from "vitest";
import { bestRun, buildWaves, waveCards } from "@/lib/match";

const words = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `w${i}`, german: `de${i}`, french: `fr${i}` }));

describe("match game", () => {
  it("covers the whole list in waves of 6", () => {
    const w = buildWaves(words(12));
    expect(w.map((x) => x.length)).toEqual([6, 6]);
    expect(new Set(w.flat().map((x) => x.id)).size).toBe(12);
  });
  it("pads a 14-word list's last wave to 6 with distinct already-seen words", () => {
    const w = buildWaves(words(14));
    expect(w.map((x) => x.length)).toEqual([6, 6, 6]);
    expect(new Set(w[2]!.map((x) => x.id)).size).toBe(6);
    expect(new Set(w.flat().map((x) => x.id)).size).toBe(14);
  });
  it("a wave has 12 cards, one German and one French per word", () => {
    const c = waveCards(words(6));
    expect(c.length).toBe(12);
    expect(c.filter((x) => x.side === "de").length).toBe(6);
  });
  it("best run resets on a mistake", () => {
    expect(bestRun([true, true, false, true, true, true, false])).toBe(3);
  });
});
