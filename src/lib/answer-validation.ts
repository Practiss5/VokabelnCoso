import { checkVerbForms, cleanSpoken, diagnoseAnswer, isSpokenCorrect, isWrittenCorrect, parseCloze, verbForms, type Word } from "@/lib/vocab";
import { z } from "zod";

export const answerSchema = z.object({
  _word: z.uuid(),
  _mode: z.enum(["flashcard", "choice", "choice_de_fr", "choice_fr_de", "listen_de_fr", "listen_fr_de", "typing", "context", "speaking"]),
  _correct: z.boolean().optional(), // Legacy queue compatibility; objective modes never trust it.
  _given: z.string().max(2000).optional(),
  _alternatives: z.array(z.string().max(500)).max(10).optional(),
  _error: z.string().max(30).optional(),
});

export function validateAnswer(word: Word, input: z.infer<typeof answerSchema>) {
  const given = input._given ?? "";
  let correct: boolean;
  if (input._mode === "flashcard") {
    // Flashcards are explicitly self-assessed. Changing this exercise requires approval.
    correct = input._correct === true;
  } else if (/^(choice|listen)/.test(input._mode)) {
    const expected = input._mode.endsWith("fr_de") ? word.german : word.french;
    correct = given === expected;
  } else if (input._mode === "context") {
    const cloze = parseCloze(word.example_de ?? "");
    if (!cloze) throw new Error("Exercice indisponible.");
    correct = isWrittenCorrect(given, cloze.answer);
  } else if (input._mode === "speaking") {
    correct = isSpokenCorrect(input._alternatives ?? [given], word.german);
  } else {
    const forms = verbForms(word.german);
    correct = forms ? checkVerbForms(given.split(","), forms).verdict === "correct" : isWrittenCorrect(given, word.german);
  }
  const error = correct ? null : input._mode === "context" ? "context" : /^(choice|listen)/.test(input._mode) ? "translation" : diagnoseAnswer(input._mode === "speaking" ? cleanSpoken(given) : given, word.german) ?? "unknown";
  return { correct, error, given };
}