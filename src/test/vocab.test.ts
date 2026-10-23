import { describe, expect, it } from "vitest";
import { buildChoices, isSpokenCorrect, isAnswerCorrect, orderQueue, type Word } from "@/lib/vocab";

const words: Word[] = [
  { id: "1", german: "das Haus", french: "la maison" },
  { id: "2", german: "der Hund", french: "le chien" },
  { id: "3", german: "die Katze", french: "le chat" },
  { id: "4", german: "der Baum", french: "l'arbre" },
  { id: "5", german: "die Straße", french: "la rue" },
];

describe("typed answers", () => {
  it("ignores case and spaces", () => expect(isAnswerCorrect("  DAS  haus ", "das Haus")).toBe(true));
  it("accepts ss for ß", () => expect(isAnswerCorrect("die Strasse", "die Straße")).toBe(true));
  it("accepts ae for ä", () => expect(isAnswerCorrect("maedchen", "Mädchen")).toBe(true));
  it("rejects a wrong article", () => expect(isAnswerCorrect("der Haus", "das Haus")).toBe(false));
  it("rejects empty", () => expect(isAnswerCorrect("", "das Haus")).toBe(false));
});

describe("multiple choice", () => {
  it("gives four options with exactly one correct", () => {
    const c = buildChoices(words[0]!, words);
    expect(c).toHaveLength(4);
    expect(c.filter((x) => x === "la maison")).toHaveLength(1);
  });
});

describe("spaced repetition queue", () => {
  const now = new Date("2026-01-10T12:00:00Z");
  it("puts missed words before new ones and skips words not yet due", () => {
    const { queue, caughtUp } = orderQueue(
      words,
      [
        { word_id: "1", due_at: "2026-01-20T00:00:00Z", repetitions: 3, wrong_count: 0, correct_count: 3 },
        { word_id: "2", due_at: "2026-01-10T11:00:00Z", repetitions: 0, wrong_count: 2, correct_count: 0 },
      ],
      now,
    );
    expect(caughtUp).toBe(false);
    expect(queue[0]?.id).toBe("2");
    expect(queue.map((w) => w.id)).not.toContain("1");
  });
  it("falls back to free practice when nothing is due", () => {
    const p = words.map((w) => ({
      word_id: w.id, due_at: "2026-02-01T00:00:00Z", repetitions: 2, wrong_count: 0, correct_count: 2,
    }));
    expect(orderQueue(words, p, now).caughtUp).toBe(true);
  });
});

import { diagnoseAnswer, isMastered } from "@/lib/vocab";
describe("error diagnosis", () => {
  it("wrong article", () => expect(diagnoseAnswer("der Haus", "das Haus")).toBe("article"));
  it("missing article", () => expect(diagnoseAnswer("Haus", "das Haus")).toBe("article"));
  it("small typo is spelling", () => expect(diagnoseAnswer("die Kaze", "die Katze")).toBe("spelling"));
  it("other word is translation", () => expect(diagnoseAnswer("der Baum", "der Hund")).toBe("translation"));
  it("case/space difference is correct", () => expect(diagnoseAnswer(" DIE katze ", "die Katze")).toBeNull());
});
describe("mastery", () => {
  it("QCM success alone is not mastery", () =>
    expect(isMastered([{ word_id: "1", skill: "translation", step: 5 }])).toBe(false));
  it("writing + recognition at step 3 is mastery", () =>
    expect(isMastered([{ word_id: "1", skill: "writing", step: 3 }, { word_id: "1", skill: "recognition", step: 3 }])).toBe(true));
});

import { buildDailySession, type SkillState } from "@/lib/vocab";
describe("daily session", () => {
  const now = new Date("2026-01-10T12:00:00Z");
  const sk = (word_id: string, skill: string, o: Partial<SkillState>): SkillState => ({
    word_id, skill, step: 1, due_at: "2026-02-01T00:00:00Z", wrong_count: 0, correct_count: 1, last_reviewed_at: "2025-12-01T00:00:00Z", ...o,
  });
  const s = buildDailySession(words, [
    sk("1", "writing", { due_at: "2026-01-09T00:00:00Z" }),
    sk("2", "translation", { wrong_count: 3, correct_count: 1 }),
    sk("3", "recognition", { step: 2, last_reviewed_at: "2026-01-09T00:00:00Z" }),
  ], now);
  it("overdue word first in its own mode", () => expect(s[0]).toMatchObject({ reason: "overdue", mode: "typing" }));
  it("fragile word is asked in writing", () => expect(s.find((i) => i.word.id === "2")).toMatchObject({ reason: "fragile", mode: "typing" }));
  it("recent word moves to a harder mode", () => expect(s.find((i) => i.word.id === "3")).toMatchObject({ reason: "recent", mode: "choice" }));
  it("new words are added", () => expect(s.filter((i) => i.reason === "new").map((i) => i.word.id)).toEqual(["4", "5"]));
  it("never more than the limit, one item per word", () => {
    const r = buildDailySession(words, [], now, 2);
    expect(r).toHaveLength(2);
  });
});

import { clozeHint, parseCloze } from "@/lib/vocab";
describe("cloze sentences", () => {
  it("extracts the bracketed answer", () => {
    expect(parseCloze("Ich habe einen [Hund].")).toEqual({ before: "Ich habe einen ", answer: "Hund", after: "." });
  });
  it("rejects sentences without a gap", () => {
    expect(parseCloze("Ich habe einen Hund.")).toBeNull();
  });
  it("hint shows first letter and length", () => {
    expect(clozeHint("der Hund")).toBe("d·· H···");
  });
  it("daily session uses a sentence once a recent word is solid", () => {
    const now = new Date("2026-10-20T10:00:00Z");
    const w = { id: "x", german: "der Hund", french: "le chien", example_de: "Das ist mein [Hund]." };
    const recent = new Date(now.getTime() - 3600e3).toISOString();
    const future = new Date(now.getTime() + 864e5).toISOString();
    const sk = ["recognition", "translation", "speaking", "writing"].map((skill) => ({ word_id: "x", skill, step: 2, due_at: future, wrong_count: 0, correct_count: 2, last_reviewed_at: recent }));
    expect(buildDailySession([w], sk, now)[0]?.mode).toBe("context");
  });
});

describe("speaking", () => {
  it("accepts a spoken answer with the article, ignoring punctuation", () => {
    expect(isSpokenCorrect(["Der Hund."], "der Hund")).toBe(true);
  });
  it("rejects a spoken answer without the article", () => {
    expect(isSpokenCorrect(["Hund"], "der Hund")).toBe(false);
  });
  it("comes after QCM in the daily progression", () => {
    const now = new Date("2026-10-20T10:00:00Z");
    const w = { id: "x", german: "der Hund", french: "le chien" };
    const recent = new Date(now.getTime() - 3600e3).toISOString();
    const sk = ["recognition", "translation"].map((skill) => ({ word_id: "x", skill, step: 2, due_at: new Date(now.getTime() + 864e5).toISOString(), wrong_count: 0, correct_count: 2, last_reviewed_at: recent }));
    expect(buildDailySession([w], sk, now)[0]?.mode).toBe("speaking");
  });
});
