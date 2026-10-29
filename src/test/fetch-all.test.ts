import { describe, expect, it } from "vitest";
import { fetchAllReviews } from "@/lib/fetch-all";

describe("fetchAllReviews", () => {
  it("loads all 1942 rows, not only the first 1000", async () => {
    const rows = Array.from({ length: 1942 }, (_, i) => i);
    const all = await fetchAllReviews(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }));
    expect(all.length).toBe(1942);
  });
});
