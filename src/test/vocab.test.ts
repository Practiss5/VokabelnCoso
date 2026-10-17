import { describe, expect, it } from "vitest";
import { buildChoices, isAnswerCorrect, orderQueue, type Word } from "@/lib/vocab";

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
    const c = buildChoices(words[0], words);
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
    expect(queue[0].id).toBe("2");
    expect(queue.map((w) => w.id)).not.toContain("1");
  });
  it("falls back to free practice when nothing is due", () => {
    const p = words.map((w) => ({
      word_id: w.id, due_at: "2026-02-01T00:00:00Z", repetitions: 2, wrong_count: 0, correct_count: 2,
    }));
    expect(orderQueue(words, p, now).caughtUp).toBe(true);
  });
});
