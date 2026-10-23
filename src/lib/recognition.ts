// Browser-only German speech recognition (Web Speech API, no AI service).
// Call only from event handlers.

type Rec = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};

function ctor(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canRecognize = () => ctor() !== null;

/** Listen once in German; resolves with alternative transcripts (empty if nothing heard). */
export function listenGerman(): { promise: Promise<string[]>; stop: () => void } {
  const C = ctor();
  if (!C) return { promise: Promise.reject(new Error("unsupported")), stop: () => {} };
  const rec = new C();
  rec.lang = "de-DE"; rec.interimResults = false; rec.maxAlternatives = 5; rec.continuous = false;
  const promise = new Promise<string[]>((resolve, reject) => {
    let out: string[] = [];
    rec.onresult = (e) => {
      const r = e.results[0];
      out = r ? Array.from({ length: r.length }, (_, i) => r[i]!.transcript) : [];
    };
    rec.onerror = (e) => (e.error === "no-speech" || e.error === "aborted" ? resolve([]) : reject(new Error(e.error)));
    rec.onend = () => resolve(out);
  });
  rec.start();
  return { promise, stop: () => rec.stop() };
}
