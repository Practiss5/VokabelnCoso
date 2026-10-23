import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buildChoices, cleanSpoken, clozeHint, isSpokenCorrect, diagnoseAnswer, parseCloze, ERROR_LABELS, isAnswerCorrect, MODE_LABELS, REASON_LABELS,
  type DailyItem, type DailyMode, type ErrorType, type Word,
} from "@/lib/vocab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GermanAudio } from "@/components/GermanAudio";
import { reviewSpeech } from "@/lib/speech";
import { canRecognize, listenGerman } from "@/lib/recognition";

export type SessionItem = { word: Word; mode: DailyMode; reason?: DailyItem["reason"] };

export function ReviewSession({ items, pool, title, notice, onQuit, endActions }: {
  items: SessionItem[]; pool: Word[]; title: string; notice?: ReactNode; onQuit: () => void; endActions?: ReactNode;
}) {
  const qc = useQueryClient();
  const [queue, setQueue] = useState(items);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<null | boolean>(null);
  const [score, setScore] = useState({ ok: 0, ko: 0 });
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [secondTry, setSecondTry] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [useKeyboard, setUseKeyboard] = useState(false);
  const stopRef = useRef<null | (() => void)>(null);
  const retried = useRef(new Set<string>());
  const item = queue[index];
  const word = item?.word;
  const mode = item?.mode;
  const cloze = mode === "context" && word ? parseCloze(word.example_de) : null;
  // QCM direction is mixed automatically: about half the questions go French → German.
  const reverse = useMemo(() => mode === "choice" && Math.random() < 0.5, [index, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = word ? (reverse ? word.german : word.french) : "";
  const choices = useMemo(() => (word ? buildChoices(word, pool, Math.random, reverse) : []), [word, pool, reverse]);

  async function answer(correct: boolean, given?: string) {
    if (answered !== null || !item || !word || !mode) return;
    const err = correct ? null : mode === "typing" || mode === "speaking" ? diagnoseAnswer(given ?? "", word.german) : mode === "context" ? "context" : "translation";
    setErrorType(err);
    setAnswered(correct);
    setScore((s) => (correct ? { ...s, ok: s.ok + 1 } : { ...s, ko: s.ko + 1 }));
    // Missed words come back once more at the end of the session.
    if (!correct && !retried.current.has(word.id)) {
      retried.current.add(word.id);
      setQueue((q) => [...q, item]);
    }
    const args: { _word: string; _mode: string; _correct: boolean; _given?: string; _error?: string } = { _word: word.id, _mode: mode, _correct: correct };
    if (given) args._given = given;
    if (err) args._error = err;
    const { error } = await supabase.rpc("record_answer", args);
    if (error) toast.error("Réponse non enregistrée : " + error.message);
  }
  function judgeSpoken(alts: string[]) {
    if (!word) return;
    const said = cleanSpoken(alts[0] ?? "");
    setHeard(said);
    if (isSpokenCorrect(alts, word.german)) return void answer(true, said);
    if (!secondTry) { setSecondTry(true); setErrorType(said ? diagnoseAnswer(said, word.german) : null); return; }
    answer(false, said);
  }
  async function speak() {
    if (listening) { stopRef.current?.(); return; }
    try {
      const l = listenGerman();
      stopRef.current = l.stop; setListening(true);
      const alts = await l.promise;
      setListening(false);
      if (!alts.length) { toast("Je n'ai rien entendu. Réessaie en parlant près du micro."); return; }
      judgeSpoken(alts);
    } catch (e) {
      setListening(false);
      const msg = (e as Error).message;
      toast.error(msg === "not-allowed" || msg === "service-not-allowed" ? "Micro refusé : autorise le micro ou passe au clavier." : "Micro indisponible : passe au clavier.");
      setUseKeyboard(true);
    }
  }
  function next() {
    setAnswered(null); setErrorType(null); setTyped(""); setPicked(null); setSecondTry(false); setShowHint(false); setHeard(""); setListening(false); setIndex((i) => i + 1);
  }

  const finished = !item;
  useEffect(() => {
    if (!finished) return;
    qc.invalidateQueries({ queryKey: ["my-lists"] });
    qc.invalidateQueries({ queryKey: ["history"] });
    qc.invalidateQueries({ queryKey: ["daily"] });
  }, [finished, qc]);

  if (!item || !word || !mode) {
    return (
      <div className="word-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-4xl font-bold">Gut gemacht !</h1>
        <p className="mt-4 text-lg">{score.ok} bonnes réponses · {score.ko} erreurs</p>
        <p className="mt-2 text-sm text-muted-foreground">Vos progrès sont enregistrés. Les mots ratés reviendront bientôt.</p>
        <div className="mt-6 flex flex-col gap-2">
          {endActions}
          <Button asChild variant="outline"><Link to="/eleve">Accueil</Link></Button>
        </div>
      </div>
    );
  }

  function submitContext() {
    if (!cloze) return;
    if (isAnswerCorrect(typed, cloze.answer)) { answer(true, typed); return; }
    // First miss: no penalty yet, show a hint and allow a second try.
    if (!secondTry) { setSecondTry(true); setErrorType(diagnoseAnswer(typed, cloze.answer)); return; }
    answer(false, typed);
  }

  const pct = Math.round((index / queue.length) * 100);
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between text-sm">
        <button className="underline" onClick={onQuit}>← Quitter</button>
        <span className="text-muted-foreground">{title} · {index + 1}/{queue.length}</span>
      </div>
      {notice && index === 0 && <div className="rounded-lg bg-secondary p-3 text-sm">{notice}</div>}
      <div>
        <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-right text-xs text-muted-foreground">{pct} %</p>
      </div>

      <div className="word-card paper-lines flex min-h-48 flex-col items-center justify-center p-8 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {item.reason ? `${REASON_LABELS[item.reason]} · ${MODE_LABELS[mode]}` : mode === "context" ? "Complète la phrase" : mode === "typing" ? "Français" : mode === "speaking" ? "Dis-le en allemand" : "Deutsch"}
        </p>
        {cloze ? (
          <>
            <p className="mt-3 font-display text-2xl leading-relaxed sm:text-3xl">
              {cloze.before}<span className="mx-1 inline-block min-w-24 border-b-2 border-foreground px-1 font-bold">{answered !== null ? cloze.answer : "\u00a0"}</span>{cloze.after}
            </p>
            {showHint || answered !== null ? (
              <p className="mt-4 text-muted-foreground">{word.french}{word.example_fr ? ` — « ${word.example_fr} »` : ""}</p>
            ) : (
              <Button variant="ghost" size="sm" className="mt-4" onClick={() => setShowHint(true)}>💡 Indice</Button>
            )}
          </>
        ) : (
          <p className="mt-2 font-display text-4xl font-bold sm:text-5xl">{mode === "typing" || mode === "speaking" ? word.french : word.german}</p>
        )}
        {mode === "flashcard" && answered !== null && <p className="mt-4 text-xl">{word.french}</p>}
        <div className="mt-3 flex justify-center">
          <GermanAudio key={`${index}-${answered}`} text={reviewSpeech(word, mode, answered !== null)}
            label={mode === "context" ? "Écouter la phrase" : "Écouter le mot"} />
        </div>
      </div>

      {mode === "flashcard" && answered === null && (
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" variant="outline" className="h-14" onClick={() => answer(false)}>Je ne connais pas</Button>
          <Button size="lg" className="h-14" onClick={() => answer(true)}>Je connais</Button>
        </div>
      )}

      {mode === "choice" && (
        <div className="grid gap-3">
          {choices.map((c) => {
            const state = answered === null ? "" : c === word.french ? "border-success bg-success text-success-foreground" : c === picked ? "border-destructive bg-destructive text-destructive-foreground" : "opacity-60";
            return (
              <button key={c} disabled={answered !== null} onClick={() => { setPicked(c); answer(c === word.french, c); }}
                className={`word-card min-h-14 px-4 py-3 text-left text-lg font-medium ${state}`}>
                {c}
              </button>
            );
          })}
        </div>
      )}

      {mode === "speaking" && (
        <div className="space-y-3">
          {answered === null && !useKeyboard && canRecognize() && (
            <Button size="lg" className={`h-20 w-full text-xl ${listening ? "animate-pulse" : ""}`} variant={listening ? "destructive" : "default"} onClick={speak}>
              {listening ? "● J'écoute… (toucher pour arrêter)" : "🎙️ Parler"}
            </Button>
          )}
          {answered === null && (useKeyboard || !canRecognize()) && (
            <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) judgeSpoken([typed]); setTyped(""); }} className="space-y-2">
              <Input autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)}
                placeholder="Mot allemand (avec l'article)" className="h-14 text-lg" />
              <div className="flex flex-wrap gap-1">
                {["ä", "ö", "ü", "ß"].map((ch) => (
                  <Button key={ch} type="button" size="sm" variant="secondary" onClick={() => setTyped((t) => t + ch)}>{ch}</Button>
                ))}
              </div>
              <Button type="submit" size="lg" className="w-full">Valider</Button>
            </form>
          )}
          {answered === null && !useKeyboard && canRecognize() && (
            <button type="button" className="w-full text-center text-sm underline text-muted-foreground" onClick={() => setUseKeyboard(true)}>Pas de micro ? Passer au clavier</button>
          )}
          {secondTry && answered === null && (
            <div className="rounded-lg border border-accent bg-accent/20 p-3 text-center">
              <p className="font-semibold">Presque ! Deuxième essai.</p>
              {heard && <p className="text-sm">J'ai compris : « {heard} »</p>}
              {errorType === "article" && <p className="text-sm font-semibold">Attention à l'article (der / die / das) !</p>}
              {errorType === "spelling" && <p className="text-sm">Tu y es presque, articule bien.</p>}
              <p className="mt-1 font-mono text-lg tracking-widest">{clozeHint(word.german)}</p>
            </div>
          )}
          {answered === false && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-center">
              <p>Bonne réponse : <b>{word.german}</b></p>
              {heard && <p className="text-sm text-muted-foreground">J'ai compris : « {heard} »</p>}
              {errorType && <p className="mt-1 text-sm font-semibold text-destructive">{ERROR_LABELS[errorType]}</p>}
            </div>
          )}
        </div>
      )}

      {mode === "typing" && (
        <form onSubmit={(e) => { e.preventDefault(); if (answered === null) answer(isAnswerCorrect(typed, word.german), typed); else next(); }} className="space-y-3">
          <Input autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false} disabled={answered !== null}
            value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Mot allemand (avec l'article)" className="h-14 text-lg" />
          <div className="flex flex-wrap gap-1">
            {["ä", "ö", "ü", "ß"].map((ch) => (
              <Button key={ch} type="button" size="sm" variant="secondary" disabled={answered !== null} onClick={() => setTyped((t) => t + ch)}>{ch}</Button>
            ))}
          </div>
          {answered === null && <Button type="submit" size="lg" className="w-full">Valider</Button>}
          {answered === false && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-center">
              <p>Bonne réponse : <b>{word.german}</b></p>
              <p className="text-sm text-muted-foreground">Vous avez écrit : « {typed} »</p>
              {errorType && <p className="mt-1 text-sm font-semibold text-destructive">{ERROR_LABELS[errorType]}</p>}
            </div>
          )}
          {answered !== null && <Button type="submit" size="lg" className="w-full">Suivant</Button>}
        </form>
      )}

      {mode === "context" && cloze && (
        <form onSubmit={(e) => { e.preventDefault(); if (answered === null) submitContext(); else next(); }} className="space-y-3">
          <Input autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false} disabled={answered !== null}
            value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Mot manquant" className="h-14 text-lg" />
          <div className="flex flex-wrap gap-1">
            {["ä", "ö", "ü", "ß"].map((ch) => (
              <Button key={ch} type="button" size="sm" variant="secondary" disabled={answered !== null} onClick={() => setTyped((t) => t + ch)}>{ch}</Button>
            ))}
          </div>
          {secondTry && answered === null && (
            <div className="rounded-lg border border-accent bg-accent/20 p-3 text-center">
              <p className="font-semibold">Presque ! Deuxième essai.</p>
              {errorType && errorType !== "translation" && <p className="text-sm">{ERROR_LABELS[errorType]}</p>}
              <p className="mt-1 font-mono text-lg tracking-widest">{clozeHint(cloze.answer)}</p>
            </div>
          )}
          {answered === null && <Button type="submit" size="lg" className="w-full">Valider</Button>}
          {answered === false && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-center">
              <p>Bonne réponse : <b>{cloze.answer}</b></p>
              <p className="text-sm text-muted-foreground">Vous avez écrit : « {typed} »</p>
            </div>
          )}
          {answered !== null && <Button type="submit" size="lg" className="w-full">Suivant</Button>}
        </form>
      )}

      {answered !== null && (
        <>
          <p className={`text-center text-lg font-bold ${answered ? "text-success" : "text-destructive"}`}>
            {answered ? "Richtig ! ✓" : "Pas encore… ✗"}
          </p>
          {answered === false && mode === "choice" && <p className="text-center">Bonne réponse : <b>{word.french}</b></p>}
          {mode !== "typing" && mode !== "context" && <Button size="lg" className="w-full" onClick={next}>Suivant</Button>}
        </>
      )}
    </div>
  );
}
