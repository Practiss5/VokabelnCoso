import { describe, expect, it } from "vitest";
import { coachMessage } from "@/components/Homework";

const now = Date.parse("2026-11-08T08:00:00Z");
const hw = (due: string, done: boolean, got = 0) => ({
  h: { due_at: due, vocab_lists: { title: due } },
  r: { done, parts: [{ key: "choice", got, need: 10, covered: got, total: 10 }] },
});

describe("coachMessage", () => {
  it("talks about the soonest unfinished homework first", () => {
    const m = coachMessage([hw("2026-11-12T08:00:00Z", false), hw("2026-11-08T20:00:00Z", false)], { days: 2, today: false }, now);
    expect(m).toContain("2026-11-08T20:00:00Z");
    expect(m).toContain("Vite");
  });
  it("flags a late homework", () => {
    expect(coachMessage([hw("2026-11-07T08:00:00Z", false)], undefined, now)).toContain("en retard");
  });
  it("reminds the daily flame when homework is done", () => {
    expect(coachMessage([hw("2026-11-12T08:00:00Z", true)], { days: 3, today: false }, now)).toContain("série de 3 jours");
  });
});
