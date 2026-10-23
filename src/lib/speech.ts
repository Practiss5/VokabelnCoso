import type { DailyMode, Word } from "@/lib/vocab";

export function germanVoice(voices: SpeechSynthesisVoice[]) {
  const german = voices.filter((voice) => /^de(?:[-_]|$)/i.test(voice.lang));
  return german.find((voice) => voice.localService) ?? german[0] ?? null;
}

export function spokenGerman(text: string) {
  return text.replace(/[\[\]]/g, "").trim();
}

// Never read an answer that the exercise still expects the student to produce.
export function reviewSpeech(word: Word, mode: DailyMode, revealed: boolean) {
  if (mode === "typing" && !revealed) return "";
  if (mode === "context") return revealed ? spokenGerman(word.example_de ?? "") : "";
  return word.german;
}