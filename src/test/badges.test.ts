import { describe, expect, it } from "vitest";
import { computeBadges, type BadgeReview } from "@/lib/badges";

const base = new Date("2026-11-01T10:00:00Z").getTime();
const r = (i: number, o: Partial<BadgeReview> = {}, stepMs = 1000): BadgeReview =>
  ({ word_id: `w${i}`, created_at: new Date(base + i * stepMs).toISOString(), mode: "typing", correct: true, error_type: null, ...o });
const get = (rv: BadgeReview[], id: string, german = new Map<string, string>(), extra = {}) =>
  computeBadges({ reviews: rv, germanById: german, earlyHomeworks: 0, bestTetris: 0, bestMatchRun: 0, now: new Date(base), ...extra }).find((b) => b.id === id)!;

describe("badges", () => {
  it("Centenaire: 100, 500, 1000, 2000", () => {
    expect(get(Array.from({ length: 99 }, (_, i) => r(i)), "century").level).toBe(0);
    expect(get(Array.from({ length: 500 }, (_, i) => r(i)), "century").level).toBe(2);
  });
  it("Maître des genres: 30 noms d'affilée sans erreur d'article", () => {
    const de = new Map(Array.from({ length: 40 }, (_, i) => [`w${i}`, "der Hund"]));
    expect(get(Array.from({ length: 30 }, (_, i) => r(i)), "gender", de).level).toBe(1);
    const broken = Array.from({ length: 30 }, (_, i) => r(i, i === 15 ? { correct: false, error_type: "article" } : {}));
    expect(get(broken, "gender", de).level).toBe(0);
  });
  it("Chasseur d'Umlaut: 50 mots écrits justes", () => {
    const de = new Map(Array.from({ length: 50 }, (_, i) => [`w${i}`, "das Mädchen"]));
    expect(get(Array.from({ length: 49 }, (_, i) => r(i)), "umlaut", de).level).toBe(0);
    expect(get(Array.from({ length: 50 }, (_, i) => r(i)), "umlaut", de).level).toBe(1);
  });
  it("Oreille d'or: 20 écoutes justes d'affilée", () => {
    expect(get(Array.from({ length: 20 }, (_, i) => r(i, { mode: "listen_de_fr" })), "ear").level).toBe(1);
    expect(get(Array.from({ length: 19 }, (_, i) => r(i, { mode: "listen_de_fr" })), "ear").level).toBe(0);
  });
  it("Sprint éclair: 10 QCM justes en 25 s maximum", () => {
    expect(get(Array.from({ length: 10 }, (_, i) => r(i, { mode: "choice" }, 2000)), "sprint").level).toBe(1);
    expect(get(Array.from({ length: 10 }, (_, i) => r(i, { mode: "choice" }, 3000)), "sprint").level).toBe(0);
  });
  it("Zéro faute: séance d'au moins 20 mots", () => {
    expect(get(Array.from({ length: 20 }, (_, i) => r(i)), "perfect").level).toBe(1);
    expect(get(Array.from({ length: 19 }, (_, i) => r(i)), "perfect").level).toBe(0);
  });
  it("Tenace: raté puis réussi", () => {
    expect(get([r(0, { word_id: "a", correct: false }), r(1, { word_id: "a" })], "tenace").level).toBe(1);
  });
  it("Polyglotte: 10 mots justes au premier essai", () => {
    expect(get(Array.from({ length: 10 }, (_, i) => r(i, { mode: "speaking" })), "polyglot").level).toBe(1);
  });
});
