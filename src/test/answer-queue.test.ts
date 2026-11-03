import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { sendAnswer, flushAnswers, pendingCount } from "@/lib/answer-queue";

const a = { _word: "w1", _mode: "choice", _correct: true };
beforeEach(() => localStorage.clear());

describe("offline answer queue", () => {
  it("keeps an answer locally when the Wi-Fi drops", async () => {
    const rpc = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await sendAnswer(a, rpc)).toBe("queued");
    expect(pendingCount()).toBe(1);
  });
  it("re-sends kept answers once back online", async () => {
    await sendAnswer(a, vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const ok = vi.fn().mockResolvedValue({ error: null });
    expect(await flushAnswers(ok)).toBe(1);
    expect(ok).toHaveBeenCalledWith(a);
    expect(pendingCount()).toBe(0);
  });
  it("does not keep answers the server refuses", async () => {
    const res = await sendAnswer(a, vi.fn().mockResolvedValue({ error: { message: "permission denied" } }));
    expect(res).toEqual({ error: "permission denied" });
    expect(pendingCount()).toBe(0);
  });
});
