import { describe, expect, it } from "vitest";
import { applyAnswer, COMBO_START, addLife, MAX_LIVES, pickBoss, pickNext, threeChoices, SLOW_MS, COMBO_BONUS_MS, type ComboState } from "@/lib/tetris";

describe("Wort-Tetris combos", () => {
  it("5 consecutive successes double only the next word", () => {
    let c: ComboState = COMBO_START;
    const pts: number[] = [];
    for (let i = 0; i < 7; i++) { const r = applyAnswer(c, true, 10, false); c = r.combo; pts.push(r.points); }
    expect(pts).toEqual([10, 10, 10, 10, 10, 20, 10]);
  });
  it("an error resets the counter", () => {
    let c: ComboState = COMBO_START;
    for (let i = 0; i < 4; i++) c = applyAnswer(c, true, 10, false).combo;
    c = applyAnswer(c, false, 10, false).combo;
    expect(c).toEqual({ streak: 0, ready: false });
  });
  it("combo + 30s bonus never give more than ×2", () => {
    expect(applyAnswer({ streak: 0, ready: true }, true, 10, true).points).toBe(20);
    expect(applyAnswer(COMBO_START, true, 10, true).points).toBe(20);
  });
});

describe("Wort-Tetris bonuses", () => {
  it("exact durations", () => { expect(SLOW_MS).toBe(5000); expect(COMBO_BONUS_MS).toBe(30000); });
  it("one life per bonus, capped", () => { expect(addLife(3)).toBe(4); expect(addLife(MAX_LIVES)).toBe(MAX_LIVES); });
});

const W = (id: string, fr = id) => ({ id, german: "das " + id, french: fr });

describe("Wort-Tetris boss & picking", () => {
  it("boss takes the hardest words from real stats first", () => {
    const words = [W("a"), W("b"), W("c")];
    const stats = [{ word_id: "c", skill: "writing", wrong_count: 4, correct_count: 0, step: 0 }, { word_id: "a", skill: "writing", wrong_count: 0, correct_count: 5, step: 3 }];
    expect(pickBoss(words, stats, ["b"], 2).map((w) => w.id)).toEqual(["c", "b"]);
  });
  it("other lists never appear before the threshold", () => {
    for (let i = 0; i < 50; i++) expect(pickNext([W("a")], [W("x")], [], 3, () => 0)!.id).toBe("a");
    expect(pickNext([W("a")], [W("x")], [], 20, () => 0)!.id).toBe("x");
  });
  it("three choices with one correct answer", () => {
    const c = threeChoices(W("a", "chien"), [W("a", "chien"), W("b", "chat"), W("c", "Chien "), W("d", "maison")]);
    expect(c).toHaveLength(3);
    expect(c.filter((x) => x.trim().toLowerCase() === "chien")).toHaveLength(1);
  });
});
