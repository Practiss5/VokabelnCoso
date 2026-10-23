import { describe, expect, it } from "vitest";
import { computeStreak, homeworkStatus } from "@/lib/vocab";

const C = "2026-10-20T08:00:00Z", D = "2026-10-23T18:00:00Z", T = "2026-10-21T10:00:00Z";
const ids = ["a", "b", "c", "d", "e"];
const r = (word_id: string, mode: string, correct = true, created_at = T) => ({ word_id, mode, correct, created_at });

describe("homeworkStatus", () => {
  it("is done with 80% at QCM level and 60% in writing", () => {
    // 4/5 QCM-or-above (choice + typing), 3/5 writing
    const s = homeworkStatus(ids, [r("a", "choice"), r("b", "typing"), r("c", "typing"), r("d", "context")], C, D);
    expect(s.qcm).toBe(4);
    expect(s.writing).toBe(3);
    expect(s.done).toBe(true);
  });
  it("is not done with only 2/5 written words", () => {
    const s = homeworkStatus(ids, [r("a", "choice"), r("b", "choice"), r("c", "typing"), r("d", "typing")], C, D);
    expect(s.done).toBe(false);
  });
  it("ignores flashcards, wrong answers and answers outside the period", () => {
    const s = homeworkStatus(ids, [r("a", "flashcard"), r("b", "typing", false), r("c", "typing", true, "2026-10-24T10:00:00Z")], C, D);
    expect(s.qcm).toBe(0);
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
