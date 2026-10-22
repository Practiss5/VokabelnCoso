import { describe, expect, it } from "vitest";
import { homeworkStatus } from "@/lib/vocab";

const C = "2026-10-20T08:00:00Z", D = "2026-10-23T18:00:00Z";
describe("homeworkStatus", () => {
  it("is done only when every word was answered before the deadline", () => {
    const r = homeworkStatus(["a", "b"], [{ word_id: "a", created_at: "2026-10-21T10:00:00Z" }, { word_id: "b", created_at: "2026-10-22T10:00:00Z" }], C, D);
    expect(r).toEqual({ done: true, answered: 2, total: 2, doneAt: "2026-10-22T10:00:00Z" });
  });
  it("ignores answers after the deadline or before assignment", () => {
    const r = homeworkStatus(["a", "b"], [{ word_id: "a", created_at: "2026-10-19T10:00:00Z" }, { word_id: "b", created_at: "2026-10-24T10:00:00Z" }], C, D);
    expect(r.done).toBe(false);
    expect(r.answered).toBe(0);
  });
});
