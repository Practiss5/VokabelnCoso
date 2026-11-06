import { describe, expect, it } from "vitest";
import { buildHomeworkPractice, homeworkStatus, nextHomeworkMode, type Word } from "@/lib/vocab";
import { studentReport } from "@/lib/report";

const created = "2026-11-01T00:00:00Z", due = "2026-11-10T00:00:00Z";
const review = (word_id: string, correct: boolean, mode = "typing", created_at = "2026-11-06T06:00:00Z") => ({ word_id, correct, mode, created_at });
const words: Word[] = Array.from({ length: 25 }, (_, i) => ({ id: `${i}`, german: `Wort ${i}`, french: `mot ${i}` }));

describe("homework coverage and continuation", () => {
  it("does not finish at 70% while words remain unseen", () => {
    const ids = words.slice(0, 10).map((w) => w.id);
    const s = homeworkStatus(ids, ids.slice(0, 7).map((id) => review(id, true)), created, due, { typing: 0.7 });
    expect(s.parts[0]).toMatchObject({ got: 7, need: 7, covered: 7, total: 10 });
    expect(s.done).toBe(false);
    expect(nextHomeworkMode(s.parts)).toBe("typing");
  });
  it("successful words need one answer and missed words need two", () => {
    const answers = [review("a", true), review("b", true), review("c", false)];
    expect(homeworkStatus(["a", "b", "c"], answers, created, due, { typing: 0.6 }).done).toBe(false);
    expect(homeworkStatus(["a", "b", "c"], [...answers, review("c", false)], created, due, { typing: 0.6 }).done).toBe(true);
  });
  it("full coverage still requires the teacher threshold", () => {
    const answers = [review("a", true), review("b", false), review("b", false)];
    expect(homeworkStatus(["a", "b"], answers, created, due, { typing: 0.7 }).done).toBe(false);
    expect(homeworkStatus(["a", "b"], [...answers, review("b", true)], created, due, { typing: 0.7 }).done).toBe(true);
  });
  it("checks coverage separately for each required exercise", () => {
    const answers = [review("a", true, "choice"), review("a", true)];
    const s = homeworkStatus(["a", "b"], [...answers, review("b", false), review("b", false)], created, due, { choice: 0.6, typing: 0.6 });
    expect(s.parts.map((p) => p.covered)).toEqual([1, 2]);
    expect(nextHomeworkMode(s.parts)).toBe("choice");
  });
  it("mixed QCM retries the missed direction independently", () => {
    const answers = [review("a", true, "choice_de_fr"), review("a", false, "choice_fr_de")];
    const one = [{ id: "a", german: "das Haus", french: "la maison" }];
    expect(buildHomeworkPractice(one, answers, "choice", { choice: 1 }, created, due).map((i) => i.dir)).toEqual(["fr_de"]);
    expect(homeworkStatus(["a"], answers, created, due, { choice: 1 }).done).toBe(false);
    expect(homeworkStatus(["a"], [...answers, review("a", true, "choice_fr_de")], created, due, { choice: 1 }).done).toBe(true);
  });
  it("continues past the first 20 words instead of repeating mastered words", () => {
    const answers = words.slice(0, 20).map((w) => review(w.id, true));
    expect(buildHomeworkPractice(words, answers, "typing", { typing: 0.7 }, created, due).map((i) => i.word.id)).toEqual(["20", "21", "22", "23", "24"]);
  });
  it("ignores answers outside the assignment period or selected words", () => {
    expect(homeworkStatus(["a"], [review("b", true), review("a", true, "typing", "2026-11-11T00:00:00Z")], created, due, { typing: 1 }).parts[0]?.covered).toBe(0);
  });
  it("parent reports use the same coverage rule", () => {
    const hw = { id: "h", list_id: "l", word_ids: ["a", "b", "c"], created_at: created, due_at: due, requirements: { typing: 0.6 } };
    const answers = [review("a", true), review("b", true)];
    expect(studentReport([hw], new Map(), answers, new Map()).done).toBe(0);
    expect(studentReport([hw], new Map(), [...answers, review("c", false), review("c", false)], new Map()).done).toBe(1);
  });
});
describe("independent homeworks", () => {
  const tagged = (word_id: string, hw: string, created_at = "2026-11-12T00:00:00Z") => ({ word_id, correct: true, mode: "typing", created_at, homework_id: hw });
  it("late answers tagged with the clicked homework complete it, marked late", () => {
    const s = homeworkStatus(["a"], [tagged("a", "old")], created, due, { typing: 1 }, "old");
    expect(s.done).toBe(true);
    expect(s.late).toBe(true);
  });
  it("answers tagged with another homework never count", () => {
    expect(homeworkStatus(["a"], [tagged("a", "new", "2026-11-05T00:00:00Z")], created, due, { typing: 1 }, "old").done).toBe(false);
  });
  it("on-time completion is not late", () => {
    const s = homeworkStatus(["a"], [tagged("a", "old", "2026-11-05T00:00:00Z")], created, due, { typing: 1 }, "old");
    expect(s.late).toBe(false);
  });
});

describe("older homeworks keep the threshold-only rule", () => {
  it("is done at 70% without full coverage when coverage rule is off", () => {
    const ids = words.slice(0, 10).map((w) => w.id);
    expect(homeworkStatus(ids, ids.slice(0, 7).map((id) => review(id, true)), created, due, { typing: 0.7 }, undefined, false).done).toBe(true);
  });
});
