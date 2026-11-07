import { describe, expect, it } from "vitest";
import { answerSchema, validateAnswer } from "@/lib/answer-validation";

const word = { id: "11111111-1111-4111-8111-111111111111", german: "die Stạdt", french: "la ville", example_de: "Ich sehe [die Stadt]." };
const judge = (mode: string, given: string, claimed = true) => validateAnswer(word, answerSchema.parse({ _word: word.id, _mode: mode, _given: given, _correct: claimed }));
describe("server answer validation", () => {
  it("ignores forged correctness for QCM and audio in both directions", () => {
    for (const mode of ["choice_de_fr", "listen_de_fr"]) {
      expect(judge(mode, "le chien").correct).toBe(false);
      expect(judge(mode, "la ville", false).correct).toBe(true);
    }
    for (const mode of ["choice_fr_de", "listen_fr_de"]) {
      expect(judge(mode, "der Hund").correct).toBe(false);
      expect(judge(mode, word.german, false).correct).toBe(true);
    }
  });
  it("preserves written spaces and textbook marks tolerance", () => {
    expect(judge("typing", "dieStadt", false).correct).toBe(true);
    expect(judge("typing", "der Stadt").correct).toBe(false);
    expect(judge("typing", "").correct).toBe(false);
  });
  it("verifies all guided verb forms", () => {
    const verb = { ...word, german: "fahren, er fährt, ist gefahren" };
    for (const [given, expected] of [["fahren, fährt, ist gefahren", true], ["fahren, fährt, hat gegangen", false]] as const) {
      expect(validateAnswer(verb, answerSchema.parse({ _word: word.id, _mode: "typing", _given: given, _correct: !expected })).correct).toBe(expected);
    }
  });
  it("accepts complete dictated verb forms without commas, independently of claimed correctness", () => {
    const verb = { ...word, german: "fahren, er fährt, ist gefahren" };
    const result = validateAnswer(verb, answerSchema.parse({ _word: word.id, _mode: "typing", _given: "fahren er fährt ist gefahren", _correct: false }));
    expect(result).toEqual({ correct: true, error: null, given: "fahren er fährt ist gefahren" });
  });
  it("still rejects missing, incorrect or reordered dictated verb forms", () => {
    const verb = { ...word, german: "fahren, er fährt, ist gefahren" };
    for (const given of ["fahren er fährt", "fahren er fährt hat gefahren", "fahren ist gefahren er fährt"]) {
      expect(validateAnswer(verb, answerSchema.parse({ _word: word.id, _mode: "typing", _given: given, _correct: true })).correct).toBe(false);
    }
  });
  it("checks context and speech independently of the claimed result", () => {
    const clozeWord = { ...word, example_de: "Ich sehe [die Stadt]." };
    expect(validateAnswer(clozeWord, answerSchema.parse({ _word: word.id, _mode: "context", _given: "dieStadt", _correct: false })).correct).toBe(true);
    expect(judge("speaking", "der Hund").correct).toBe(false);
    expect(judge("speaking", "die Stadt", false).correct).toBe(true);
  });
  it("rejects invalid mode, oversized input and invalid word identifiers", () => {
    expect(() => answerSchema.parse({ _word: "bad", _mode: "typing" })).toThrow();
    expect(() => answerSchema.parse({ _word: word.id, _mode: "admin" })).toThrow();
    expect(() => answerSchema.parse({ _word: word.id, _mode: "typing", _given: "x".repeat(2001) })).toThrow();
  });
});