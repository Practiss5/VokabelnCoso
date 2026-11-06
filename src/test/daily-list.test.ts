import { beforeEach, describe, expect, it, vi } from "vitest";

const { requests } = vi.hoisted(() => ({ requests: [] as { table: string; filters: Record<string, unknown> }[] }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => {
    const request = { table, filters: {} as Record<string, unknown> };
    requests.push(request);
    const chain = {
      select: () => chain,
      eq: (key: string, value: unknown) => { request.filters[key] = value; return chain; },
      gte: () => chain,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: table === "list_assignments" ? [{ vocab_lists: { words: [{
          id: request.filters['list_id'] ?? "all", german: "die Stadt", french: "la ville", example_de: null, example_fr: null,
        }] } }] : [], count: 0, error: null,
      }).then(resolve),
    };
    return chain;
  } },
}));

import { dailyQuery } from "@/lib/daily";

describe("list-scoped student sessions", () => {
  beforeEach(() => requests.length = 0);
  it("uses the chosen list for both session words and answer pool", async () => {
    const query = dailyQuery("student", "class", "older-list");
    if (typeof query.queryFn !== "function") throw new Error("Missing query function");
    const result = await query.queryFn({} as Parameters<typeof query.queryFn>[0]);
    expect(requests.find((request) => request.table === "list_assignments")?.filters).toEqual({ class_id: "class", list_id: "older-list" });
    expect(result.words.map((word) => word.id)).toEqual(["older-list"]);
    expect(result.items.every((item) => item.word.id === "older-list")).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });
  it("isolates cached sessions for two different lists", () => {
    expect(dailyQuery("student", "class", "older-list").queryKey)
      .not.toEqual(dailyQuery("student", "class", "latest-list").queryKey);
  });
});