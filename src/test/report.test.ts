import { describe, expect, it } from "vitest";
import { studentReport } from "@/lib/report";

const hw = (id: string) => ({ id, created_at: "2026-10-01T00:00:00Z", due_at: "2026-10-10T00:00:00Z", list_id: "L", word_ids: ["a"], requirements: { choice: 0.7 } });
const rev = (correct: boolean, at = "2026-10-05T00:00:00Z") => ({ word_id: "a", created_at: at, mode: "choice", correct });

describe("studentReport", () => {
  it("averages time only over homework with recorded time", () => {
    const r = studentReport([hw("1"), hw("2"), hw("3")], new Map(), [], new Map([["1", 600], ["2", 1200]]));
    expect(r.totalSeconds).toBe(1800);
    expect(r.avgSeconds).toBe(900);
  });
  it("success rate is correct answers over all answers", () => {
    expect(studentReport([], new Map(), [rev(true), rev(false), rev(true), rev(true)], new Map()).rate).toBe(75);
  });
  it("counts homework done only before the deadline", () => {
    expect(studentReport([hw("1")], new Map(), [rev(true)], new Map()).done).toBe(1);
    expect(studentReport([hw("1")], new Map(), [rev(true, "2026-10-11T00:00:00Z")], new Map()).done).toBe(0);
  });
});
