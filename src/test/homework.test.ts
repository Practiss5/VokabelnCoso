import { describe, expect, it } from "vitest";
import { computeStreak, homeworkCsv, homeworkStatus, pickQuizWords } from "@/lib/vocab";

const C = "2026-10-20T08:00:00Z", D = "2026-10-23T18:00:00Z", T = "2026-10-21T10:00:00Z";
const ids = ["a", "b", "c", "d", "e"];
const r = (word_id: string, mode: string, correct = true, created_at = T) => ({ word_id, mode, correct, created_at });

describe("homeworkStatus", () => {
  it("is done with 80% at QCM level and 60% in writing", () => {
    // 4/5 QCM-or-above (choice + typing), 3/5 writing
    const s = homeworkStatus(ids, [r("a", "choice"), r("b", "typing"), r("c", "typing"), r("d", "context")], C, D);
    expect(s.parts.map((p) => p.got)).toEqual([4, 3]);
    expect(s.done).toBe(true);
  });
  it("is not done with only 2/5 written words", () => {
    const s = homeworkStatus(ids, [r("a", "choice"), r("b", "choice"), r("c", "typing"), r("d", "typing")], C, D);
    expect(s.done).toBe(false);
  });
  it("ignores flashcards, wrong answers and answers outside the period", () => {
    const s = homeworkStatus(ids, [r("a", "flashcard"), r("b", "typing", false), r("c", "typing", true, "2026-10-24T10:00:00Z")], C, D);
    expect(s.parts[0].got).toBe(0);
  });
  const ten = Array.from({ length: 10 }, (_, i) => `w${i}`);
  const ok = (n: number, mode: string) => ten.slice(0, n).map((w) => r(w, mode));
  it("custom: 70 % in QCM means 7 words out of 10", () => {
    expect(homeworkStatus(ten, ok(7, "choice"), C, D, { choice: 0.7 }).done).toBe(true);
    expect(homeworkStatus(ten, ok(6, "choice"), C, D, { choice: 0.7 }).done).toBe(false);
  });
  it("custom: every chosen mode must reach its own rate", () => {
    const req = { choice: 0.8, speaking: 1 };
    expect(homeworkStatus(ten, [...ok(8, "choice"), ...ok(9, "speaking")], C, D, req).done).toBe(false);
    expect(homeworkStatus(ten, [...ok(8, "choice"), ...ok(10, "speaking")], C, D, req).done).toBe(true);
  });
  it("custom: a mode only counts its own answers and flashcards can be required", () => {
    expect(homeworkStatus(ten, ok(10, "typing"), C, D, { choice: 0.6 }).done).toBe(false);
    expect(homeworkStatus(ten, ok(6, "flashcard"), C, D, { flashcard: 0.6 }).done).toBe(true);
  });
  it("custom: only the selected words count", () => {
    expect(homeworkStatus(["w0", "w1"], ok(2, "choice"), C, D, { choice: 1 }).done).toBe(true);
  });
});

describe("computeStreak", () => {
  const day = (d: number, n: number) => Array(n).fill(`2026-10-${d}T10:00:00`);
  it("counts consecutive days with at least 16 answers", () => {
    expect(computeStreak([...day(21, 16), ...day(22, 20), ...day(23, 16)], new Date("2026-10-23T12:00:00"))).toEqual({ days: 3, today: true });
  });
  it("keeps yesterday's streak alive and breaks on a gap", () => {
    expect(computeStreak([...day(20, 16), ...day(22, 16)], new Date("2026-10-23T12:00:00"))).toEqual({ days: 1, today: false });
  });
  it("does not count a day below 16 answers", () => {
    expect(computeStreak(day(23, 15), new Date("2026-10-23T12:00:00")).days).toBe(0);
  });
});

describe("paper quiz & export", () => {
  it("picks the same 12 words for the same seed", () => {
    const w = Array.from({ length: 20 }, (_, i) => i);
    expect(pickQuizWords(w, 12, 0.42)).toEqual(pickQuizWords(w, 12, 0.42));
    expect(pickQuizWords(w, 12, 0.42)).toHaveLength(12);
  });
  it("exports one line per student with the status", () => {
    const csv = homeworkCsv("Haus", "23/10/2026", false, [{ name: "Léa", done: true, parts: [{ key: "qcm", label: "QCM", rate: 0.8, got: 4, need: 4 }, { key: "writing", label: "Écriture", rate: 0.6, got: 3, need: 3 }] }]);
    expect(csv.split("\r\n")[1]).toBe('"Léa";"Fait";4;4;3;3;"Haus";"23/10/2026"');
  });
  it("says 'À faire' before the deadline and 'Non fait' after it", () => {
    const row = { name: "Tom", done: false, parts: [{ key: "choice", label: "QCM", rate: 0.7, got: 1, need: 4 }] };
    expect(homeworkCsv("Haus", "x", false, [row]).split("\r\n")[1]).toContain('"À faire"');
    expect(homeworkCsv("Haus", "x", true, [row]).split("\r\n")[1]).toContain('"Non fait"');
  });
});
