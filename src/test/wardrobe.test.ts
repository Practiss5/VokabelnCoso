import { describe, expect, it } from "vitest";
import { isMasteredList, longestRun } from "@/lib/wardrobe";

const r = (word_id: string, mode: string, correct = true) => ({ word_id, mode, correct });

describe("isMasteredList", () => {
  const ids = ["a", "b"];
  it("needs every word correct in writing, QCM and audio QCM", () => {
    const all = ids.flatMap((id) => [r(id, "typing"), r(id, "choice"), r(id, "listen_de_fr")]);
    expect(isMasteredList(ids, all)).toBe(true);
  });
  it("is not mastered when one skill is missing for one word", () => {
    const missingAudio = [r("a", "typing"), r("a", "choice"), r("a", "listen_de_fr"), r("b", "typing"), r("b", "choice")];
    expect(isMasteredList(ids, missingAudio)).toBe(false);
  });
  it("wrong answers do not count", () => {
    const wrong = [r("a", "typing"), r("a", "choice"), r("a", "listen_de_fr", false)];
    expect(isMasteredList(["a"], wrong)).toBe(false);
  });
  it("accepts directed QCM modes and dictation as writing", () => {
    const all = [r("a", "context"), r("a", "choice_fr_de"), r("a", "listen_fr_de")];
    expect(isMasteredList(["a"], all)).toBe(true);
  });
  it("flashcards never count toward mastery", () => {
    expect(isMasteredList(["a"], [r("a", "flashcard"), r("a", "choice"), r("a", "listen_de_fr")])).toBe(false);
  });
  it("an empty list is never mastered", () => {
    expect(isMasteredList([], [r("a", "typing")])).toBe(false);
  });
});

describe("longestRun", () => {
  it("counts the longest streak of true values", () => {
    expect(longestRun([true, true, false, true, true, true])).toBe(3);
    expect(longestRun([])).toBe(0);
  });
});
