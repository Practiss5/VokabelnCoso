import { describe, expect, it } from "vitest";
import { hasPendingHomework } from "@/components/Homework";

const now = Date.parse("2026-10-29T12:00:00Z");
const hw = (due: string, done: boolean) => ({ h: { due_at: due }, r: { done } });

describe("hasPendingHomework (séance du jour masquée)", () => {
  it("masque si un devoir non fait n'est pas échu", () => {
    expect(hasPendingHomework([hw("2026-11-01T00:00:00Z", false)], now)).toBe(true);
  });
  it("affiche si tous les devoirs sont faits", () => {
    expect(hasPendingHomework([hw("2026-11-01T00:00:00Z", true)], now)).toBe(false);
  });
  it("affiche si le seul devoir non fait est en retard", () => {
    expect(hasPendingHomework([hw("2026-10-28T00:00:00Z", false)], now)).toBe(false);
  });
});
