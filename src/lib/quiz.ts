import { buildChoices, isWrittenCorrect, shuffle, type Word } from "@/lib/vocab";

export type QuizMode = "choice" | "audio" | "typing";
export type QuizQuestion = { word_id: string; mode: QuizMode; prompt: string; options: string[]; answer: string; seconds: number };

export const QUIZ_SECONDS: Record<QuizMode, number> = { choice: 20, audio: 20, typing: 45 };
export const QUIZ_MODE_LABELS: Record<QuizMode, string> = { choice: "QCM", audio: "QCM audio", typing: "Écriture" };

export function buildQuiz(words: Word[], modes: QuizMode[], count: number, rng: () => number = Math.random): QuizQuestion[] {
  const picked = shuffle(words, rng).slice(0, count);
  return picked.map((w, i) => {
    const mode = modes[i % modes.length] as QuizMode;
    if (mode === "typing") return { word_id: w.id, mode, prompt: w.french, options: [], answer: w.german, seconds: QUIZ_SECONDS.typing };
    // Audio: hear the German word, pick the French. QCM: random direction.
    const reverse = mode === "choice" && rng() < 0.5;
    return {
      word_id: w.id, mode, prompt: reverse ? w.french : w.german,
      options: buildChoices(w, words, rng, reverse), answer: reverse ? w.german : w.french, seconds: QUIZ_SECONDS[mode],
    };
  });
}

export function quizCorrect(q: Pick<QuizQuestion, "mode" | "answer">, given: string): boolean {
  return q.mode === "typing" ? isWrittenCorrect(given, q.answer) : given === q.answer;
}

/** 100 points for a right answer plus up to 50 for speed; nothing for a wrong one. */
export function quizPoints(correct: boolean, ms: number, seconds: number): number {
  if (!correct) return 0;
  return 100 + Math.round(50 * Math.max(0, 1 - ms / (seconds * 1000)));
}
