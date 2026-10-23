import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GermanAudio } from "@/components/GermanAudio";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup(voices: SpeechSynthesisVoice[]) {
  const events = new EventTarget();
  const synth = {
    getVoices: vi.fn(() => voices), speak: vi.fn(), cancel: vi.fn(),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", class {
    constructor(public text: string) {}
  });
  return { synth, events };
}

describe("Native speech control", () => {
  it("speaks German on demand and can stop without submitting a form", async () => {
    const voice = { lang: "de-DE", localService: true } as SpeechSynthesisVoice;
    const { synth } = setup([voice]);
    const submit = vi.fn();
    render(<form onSubmit={submit}><GermanAudio text="Mein [Hund] spielt." /></form>);
    fireEvent.click(await screen.findByRole("button", { name: "Écouter le mot" }));
    expect(submit).not.toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(synth.speak.mock.calls[0]?.[0]).toMatchObject({ text: "Mein Hund spielt.", lang: "de-DE", rate: 0.85, voice });
    fireEvent.click(screen.getByRole("button", { name: "Arrêter la lecture" }));
    expect(synth.cancel).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Écouter le mot" })).toBeEnabled();
  });
  it("waits for voices loaded asynchronously and cancels when leaving", async () => {
    const voices: SpeechSynthesisVoice[] = [];
    const { synth, events } = setup(voices);
    const { unmount } = render(<GermanAudio text="der Hund" />);
    expect(screen.queryByRole("button")).toBeNull();
    voices.push({ lang: "de-DE", localService: true } as SpeechSynthesisVoice);
    events.dispatchEvent(new Event("voiceschanged"));
    fireEvent.click(await screen.findByRole("button", { name: "Écouter le mot" }));
    unmount();
    expect(synth.cancel).toHaveBeenCalledTimes(2);
  });
  it("does not offer audio without a German voice", async () => {
    const { synth } = setup([{ lang: "fr-FR" } as SpeechSynthesisVoice]);
    render(<GermanAudio text="der Hund" />);
    await waitFor(() => expect(synth.getVoices).toHaveBeenCalled());
    expect(screen.queryByRole("button")).toBeNull();
    expect(synth.speak).not.toHaveBeenCalled();
  });
});