import { describe, expect, it } from "vitest";
import { germanVoice, reviewSpeech, spokenGerman } from "@/lib/speech";

const word = { id: "1", german: "der Hund", french: "le chien", example_de: "Mein [Hund] spielt." };
const voice = (lang: string, localService: boolean) => ({ lang, localService }) as SpeechSynthesisVoice;

describe("German audio", () => {
  it("prefers an installed German voice", () => {
    const local = voice("de-DE", true);
    expect(germanVoice([voice("fr-FR", true), voice("de-AT", false), local])).toBe(local);
  });
  it("returns no voice when German is unavailable", () => {
    expect(germanVoice([voice("fr-FR", true)])).toBeNull();
  });
  it("dictation reads the German word before it is revealed", () => {
    expect(reviewSpeech(word, "dictation", false)).toBe("der Hund");
  });
  it("removes exercise brackets from spoken sentences", () => {
    expect(spokenGerman("Mein [Hund] spielt.")).toBe("Mein Hund spielt.");
  });
  it("does not disclose a writing answer before validation", () => {
    expect(reviewSpeech(word, "typing", false)).toBe("");
    expect(reviewSpeech(word, "typing", true)).toBe("der Hund");
  });
  it("does not disclose a missing word before validation", () => {
    expect(reviewSpeech(word, "context", false)).toBe("");
    expect(reviewSpeech(word, "context", true)).toBe("Mein Hund spielt.");
  });
  it("reads the displayed German word in cards and quizzes", () => {
    expect(reviewSpeech(word, "flashcard", false)).toBe("der Hund");
    expect(reviewSpeech(word, "choice", false)).toBe("der Hund");
  });
});