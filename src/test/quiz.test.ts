import { describe, expect, it } from "vitest";
import { buildQuiz, quizCorrect, quizPoints } from "@/lib/quiz";

const words = ["a", "b", "c", "d", "e"].map((x) => ({ id: x, german: `das ${x}`, french: `le ${x}` }));
describe("class quiz", () => {
  it("gives writing 45 seconds and choice/audio 20 seconds", () => {
    const qs = buildQuiz(words, ["choice", "audio", "typing"], 3);
    expect(qs.map((q) => q.seconds)).toEqual([20, 20, 45]);
  });
  it("audio asks for the French of the spoken German word", () => {
    const [q] = buildQuiz(words, ["audio"], 1);
    expect(q.options).toContain(q.answer);
    expect(q.answer.startsWith("le ")).toBe(true);
  });
  it("checks writing with the usual tolerance", () => {
    expect(quizCorrect({ mode: "typing", answer: "das a" }, "dasa")).toBe(true);
    expect(quizCorrect({ mode: "typing", answer: "das a" }, "die a")).toBe(false);
  });
  it("scores 0 when wrong and rewards speed", () => {
    expect(quizPoints(false, 1000, 20)).toBe(0);
    expect(quizPoints(true, 0, 20)).toBe(150);
    expect(quizPoints(true, 20000, 20)).toBe(100);
  });
});
