import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.save, from: mocks.from } }));
import { submitAnswer } from "@/lib/answers.functions";

const word = { id: "word", list_id: "list", german: "das Haus", french: "la maison", example_de: null };
const run = submitAnswer as unknown as (args: { data: object; context: object }) => Promise<unknown>;
function context() {
  return { userId: "student", supabase: {
    rpc: vi.fn(async () => ({ data: true })),
    from: vi.fn((table: string) => {
      if (table !== "words") throw new Error("Unexpected homework pre-rejection");
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: word }) }) }) };
    }),
  } };
}
beforeEach(() => { vi.clearAllMocks(); mocks.save.mockResolvedValue({ error: null }); });
describe("homework answer saving", () => {
  it("saves an out-of-selection answer without pre-rejecting it; RPC decides the tag", async () => {
    const result = await run({ data: { _word: "word", _mode: "typing", _given: "das Haus", _homework: "partial-homework" }, context: context() });
    expect(result).toEqual({ error: null });
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith("record_verified_answer", {
      _student: "student", _word: "word", _mode: "typing", _correct: true, _given: "das Haus", _homework: "partial-homework",
    });
  });
  it("passes a late homework directly in the same save and never retags an older answer", async () => {
    await run({ data: { _word: "word", _mode: "typing", _given: "das Haus", _homework: "late-homework" }, context: context() });
    expect(mocks.save.mock.calls[0]?.[1]._homework).toBe("late-homework");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});