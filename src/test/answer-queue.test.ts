import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/answers.functions", () => ({ submitAnswer: vi.fn() }));
import { sendAnswer, flushAnswers, pendingCount } from "@/lib/answer-queue";

const a = { _word: "w1", _mode: "choice", _correct: true };
const down = () => vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
beforeEach(() => localStorage.clear());

describe("offline answer queue", () => {
  it("keeps an answer locally when the Wi-Fi drops", async () => {
    expect(await sendAnswer(a, down(), "A")).toBe("queued");
    expect(pendingCount("A")).toBe(1);
  });
  it("re-sends kept answers once back online", async () => {
    await sendAnswer(a, down(), "A");
    const ok = vi.fn().mockResolvedValue({ error: null });
    expect(await flushAnswers(ok, "A")).toBe(1);
    expect(ok).toHaveBeenCalledWith(a);
    expect(pendingCount("A")).toBe(0);
  });
  it("does not keep answers the server refuses", async () => {
    const res = await sendAnswer(a, vi.fn().mockResolvedValue({ error: { message: "bad word" } }), "A");
    expect(res).toEqual({ error: "bad word" });
    expect(pendingCount("A")).toBe(0);
  });
  it("never sends student A's answers for student B", async () => {
    await sendAnswer(a, down(), "A");
    const ok = vi.fn().mockResolvedValue({ error: null });
    expect(await flushAnswers(ok, "B")).toBe(0);
    expect(ok).not.toHaveBeenCalled();
    expect(pendingCount("A")).toBe(1);
  });
  it("keeps answers when nobody is signed in", async () => {
    await sendAnswer(a, down(), "A");
    expect(await flushAnswers(vi.fn(), null)).toBe(0);
    expect(pendingCount("A")).toBe(1);
  });
  it("keeps answers on a session error", async () => {
    await sendAnswer(a, down(), "A");
    await flushAnswers(vi.fn().mockResolvedValue({ error: { message: "JWT expired" } }), "A");
    expect(pendingCount("A")).toBe(1);
  });
});
