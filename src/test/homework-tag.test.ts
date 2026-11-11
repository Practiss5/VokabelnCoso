import { describe, it, expect } from "vitest";
import { pickHomeworkForAnswer } from "@/lib/homework-tag";

const now = new Date("2026-11-11T12:00:00Z");
const A = { id: "A", word_ids: ["w1", "w2"], due_at: "2026-11-13T00:00:00Z", archived_at: null };
const B = { id: "B", word_ids: null, due_at: "2026-11-20T00:00:00Z", archived_at: null };
const late = { id: "L", word_ids: ["w1"], due_at: "2026-11-01T00:00:00Z", archived_at: null };

describe("pickHomeworkForAnswer", () => {
  it("free practice on a homework word counts for the active homework ending first, only one", () => {
    expect(pickHomeworkForAnswer([B, A], "w1", undefined, now)).toBe("A");
  });
  it("a word outside the selection is saved without that homework", () => {
    expect(pickHomeworkForAnswer([A], "w9", "A", now)).toBeNull();
  });
  it("a clicked late homework keeps its answers", () => {
    expect(pickHomeworkForAnswer([late, A], "w1", "L", now)).toBe("L");
  });
  it("archived homework never receives answers", () => {
    expect(pickHomeworkForAnswer([{ ...A, archived_at: "x" }], "w1", "A", now)).toBeNull();
  });
});
