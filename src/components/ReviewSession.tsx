import { notifyAnswer } from "@/lib/study-time";
import { sendAnswer, startAnswerSync } from "@/lib/answer-queue";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  buildChoices, qcmReverse, cleanSpoken, clozeHint, isSpokenCorrect, isWrittenCorrect, isNearMiss, diagnoseAnswer, parseCloze, ERROR_LABELS, isAnswerCorrect, MODE_LABELS, REASON_LABELS, verbForms, checkVerbForms,
  type DailyItem, type DailyMode, type QcmDirection, type ErrorType, type Word,
} from "@/lib/vocab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GermanAudio } from "@/components/GermanAudio";
import { reviewSpeech } from "@/lib/speech";
import { canRecognize, listenGerman } from "@/lib/recognition";

export type SessionItem = { word: Word; mode: DailyMode; reason?: DailyItem["reason"]; dir?: "fr_de" | "de_fr" | undefined };
const VERB_LABELS = ["Infinitif", "er / sie / es …", "Parfait (hat / ist …)"];

export function ReviewSession({ items, pool, title, notice, onQuit, endActions, qcmDirection = "mixed", homeworkId, homeworkWords }: {
  homeworkId?: string; homeworkWords?: string[] | null;
  items: SessionItem[]; pool: Word[]; title: string; notice?: ReactNode; onQuit: () => void; endActions?: ReactNode; qcmDirection?: QcmDirection;
}) {
  const qc = useQueryClient();
  const [queue, setQueue] = useState(items);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<null | boolean>(null);
  const [score, setScore] = useState({ ok: 0, ko: 0 });
  const [saving, setSaving] = useState(0);
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
  const verb = mode === "typing" && word ? verbForms(word.german) : null;
  const [forms, setForms] = useState(["", "", ""]);
  const [formsOk, setFormsOk] = useState<boolean[] | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const formRefs = useRef<(HTMLInputElement | null)[]>([]);
  // QCM direction: set by the homework, otherwise mixed (about half French → German).
  const isQcm = mode === "choice" || mode === "listen";
  const reverse = useMemo(() => isQcm && (item?.dir ? item.dir === "fr_de" : qcmReverse(qcmDirection)), [index, mode, qcmDirection]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = word ? (reverse ? word.german : word.french) : "";
  const choices = useMemo(() => (word ? buildChoices(word, pool, Math.random, reverse, mode === "listen" ? 3 : 4) : []), [word, pool, reverse, mode]);
  // Audio QCM French → German: the German options are only heard, never shown before answering.
  const audioChoices = mode === "listen" && reverse;

  async function answer(correct: boolean, given?: string, alternatives?: string[]) {
    if (answered !== null || !item || !word || !mode) return;
    const err = correct ? null : mode === "typing" || mode === "speaking" || mode === "dictation" ? diagnoseAnswer(given ?? "", word.german) : mode === "context" ? "context" : "translation";
    setErrorType(err);
    setAnswered(correct);
    setScore((s) => (correct ? { ...s, ok: s.ok + 1 } : { ...s, ko: s.ko + 1 }));
    // Missed words come back once more at the end of the session.
    const retryKey = `${word.id}:${mode}:${item.dir ?? "mixed"}`;
    if (!correct && !retried.current.has(retryKey)) {
      retried.current.add(retryKey);
      setQueue((q) => [...q, item]);
    }
    const args: { _word: string; _mode: string; _correct: boolean; _given?: string; _error?: string; _alternatives?: string[]; _homework?: string } = { _word: word.id, _mode: mode === "dictation" ? "typing" : isQcm ? `${mode}_${reverse ? "fr_de" : "de_fr"}` : mode, _correct: correct };
    if (alternatives) args._alternatives = alternatives;
    if (homeworkId && (!homeworkWords || homeworkWords.includes(word.id))) args._homework = homeworkId;
    if (given) args._given = given;
    if (err) args._error = err;
    setSaving((n) => n + 1);
    const res = await sendAnswer(args).finally(() => setSaving((n) => n - 1));
    if (res === "ok") notifyAnswer();
    else if (res === "queued") toast("Connexion perdue : ta réponse est gardée et sera envoyée automatiquement.", { id: "offline" });
    else toast.error("Réponse non enregistrée : " + res.error);
  }
  function judgeSpoken(alts: string[]) {
    if (!word) return;
    const said = cleanSpoken(alts[0] ?? "");
    setHeard(said);
    if (isSpokenCorrect(alts, word.german)) return void answer(true, said, alts);
    if (!secondTry) { setSecondTry(true); setErrorType(said ? diagnoseAnswer(said, word.german) : null); return; }
    answer(false, said, alts);
  }
  async function speak() {
    if (listening) { stopRef.current?.(); return; }
    try {
      setHeard("");
      const l = listenGerman((t) => setHeard(t));
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
    setForms(["", "", ""]); setFormsOk(null); setFocusIdx(0);
    setAnswered(null); setErrorType(null); setTyped(""); setPicked(null); setSecondTry(false); setShowHint(false); setHeard(""); setListening(false); setIndex((i) => i + 1);
  }

  const [canSpeak, setCanSpeak] = useState(true);
  useEffect(() => { startAnswerSync(); }, []);
  useEffect(() => {
    if (!("speechSynthesis" in window)) { setCanSpeak(false); return; }
    const t = setTimeout(() => setCanSpeak(window.speechSynthesis.getVoices().some((v) => /^de(?:[-_]|$)/i.test(v.lang))), 1500);
    return () => clearTimeout(t);
  }, []);
  const finished = !item;
  useEffect(() => {
    if (!finished) return;
    qc.invalidateQueries({ queryKey: ["my-lists"] });
    qc.invalidateQueries({ queryKey: ["history"] });
    qc.invalidateQueries({ queryKey: ["daily"] });
    qc.invalidateQueries({ queryKey: ["my-homeworks"] });
  }, [finished, qc]);

  if (!item || !word || !mode) {
    return (
      <div className="word-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-4xl font-bold">Gut gemacht !</h1>
        <p className="mt-4 text-lg">{score.ok} bonnes réponses · {score.ko} erreurs</p>
        <p className="mt-2 text-sm text-muted-foreground">Vos progrès sont enregistrés. Les mots ratés reviendront bientôt.</p>
        <div className="mt-6 flex flex-col gap-2">
          {saving ? <p className="text-sm text-muted-foreground">Enregistrement des réponses…</p> : endActions}
          <Button asChild variant="outline"><Link to="/eleve">Accueil</Link></Button>
        </div>
      </div>
    );
  }

  function submitContext() {
    if (!cloze) return;
    if (isWrittenCorrect(typed, cloze.answer)) { answer(true, typed); return; }
    // First miss: no penalty yet, show a hint and allow a second try.
    if (!secondTry) { setSecondTry(true); setErrorType(isNearMiss(typed, cloze.answer) ? null : diagnoseAnswer(typed, cloze.answer)); return; }
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
          {item.reason ? `${REASON_LABELS[item.reason]} · ${MODE_LABELS[mode]}` : mode === "context" ? "Complète la phrase" : mode === "dictation" ? "Écoute et écris en allemand" : mode === "typing" ? "Français" : mode === "speaking" ? "Dis-le en allemand" : mode === "listen" ? (reverse ? "Français → écoute et choisis l'allemand" : "Écoute l'allemand → choisis le français") : reverse ? "Français → choisis l'allemand" : mode === "choice" ? "Allemand → choisis le français" : "Deutsch"}
        </p>
        {cloze ? (
          <>
            <p className="mt-3 font-display text-2xl leading-relaxed sm:text-3xl">
              {cloze.before}<span className="mx-1 inline-block min-w-24 border-b-2 border-foreground px-1 font-bold">{answered !== null ? cloze.answer : "\u00a0"}</span>{cloze.after}
            </p>
            <p className="mt-4 text-lg text-muted-foreground">
              {word.example_fr ? `« ${word.example_fr} »` : ""}
              <span className="mt-1 block text-base">Mot à trouver : <b>{word.french}</b></span>
            </p>
          </>
        ) : mode === "dictation" || (mode === "listen" && !reverse) ? (
          answered !== null
            ? <><p className="mt-2 font-display text-4xl font-bold sm:text-5xl">{word.german}</p><p className="mt-2 text-xl">{word.french}</p></>
            : <p className="mt-2 text-sm text-muted-foreground">Le mot est lu à voix haute. Touche le haut-parleur pour le réécouter.</p>
        ) : audioChoices ? (
          <><p className="mt-2 font-display text-4xl font-bold sm:text-5xl">{word.french}</p>{answered !== null && <p className="mt-2 text-xl">{word.german}</p>}</>
        ) : (
          <p className="mt-2 font-display text-4xl font-bold sm:text-5xl">{mode === "typing" || mode === "speaking" || reverse ? word.french : word.german}</p>
        )}
        {mode === "flashcard" && answered !== null && <p className="mt-4 text-xl">{word.french}</p>}
        <div className="mt-3 flex justify-center">
          <GermanAudio key={`${index}-${answered}`} autoPlay={(mode === "dictation" || (mode === "listen" && !reverse)) && answered === null} large={(mode === "dictation" || (mode === "listen" && !reverse)) && answered === null} text={reviewSpeech(word, reverse ? "typing" : mode === "listen" ? "dictation" : mode, answered !== null)}
            label={mode === "context" ? "Écouter la phrase" : "Écouter le mot"} />
        </div>
      </div>

      {mode === "flashcard" && answered === null && (
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" variant="outline" className="h-14" onClick={() => answer(false)}>Je ne connais pas</Button>
          <Button size="lg" className="h-14" onClick={() => answer(true)}>Je connais</Button>
        </div>
      )}

      {audioChoices && (
        <div className="grid gap-3">
          {choices.map((c, i) => {
            const state = answered === null ? "" : c === target ? "border-success bg-success text-success-foreground" : c === picked ? "border-destructive bg-destructive text-destructive-foreground" : "opacity-60";
            return (
              <div key={c} className={`word-card flex min-h-14 items-center gap-3 px-4 py-2 ${state}`}>
                <GermanAudio text={c} label={`Écouter ${"ABC"[i]}`} />
                <button disabled={answered !== null} onClick={() => { setPicked(c); answer(c === target, c); }} className="flex-1 text-left text-lg font-medium">
                  {answered === null ? `Choisir ${"ABC"[i]}` : `${"ABC"[i]} · ${c}`}
                </button>
              </div>
            );
          })}
          {!canSpeak && <p className="rounded-lg bg-secondary p-3 text-center text-sm">Aucune voix allemande sur cet appareil : cet exercice est impossible ici.</p>}
        </div>
      )}
      {isQcm && !audioChoices && (
        <div className="grid gap-3">
          {choices.map((c) => {
            const state = answered === null ? "" : c === target ? "border-success bg-success text-success-foreground" : c === picked ? "border-destructive bg-destructive text-destructive-foreground" : "opacity-60";
            return (
              <button key={c} disabled={answered !== null} onClick={() => { setPicked(c); answer(c === target, c); }}
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
          {listening && <p className="text-center text-sm text-muted-foreground">J'entends : « {heard || "…"} »</p>}
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

      {mode === "dictation" && !canSpeak && (
        <p className="rounded-lg bg-secondary p-3 text-center text-sm">Aucune voix allemande sur cet appareil : la dictée est impossible ici. Essaie un autre mode ou un autre navigateur.</p>
      )}
      {mode === "typing" && verb && (
        <form onSubmit={(e) => { e.preventDefault(); if (answered !== null) return next();
          const res = checkVerbForms(forms, verb);
          setFormsOk(res.ok);
          const given = forms.map((f) => f.trim()).join(", ");
          if (res.verdict === "correct") return void answer(true, given);
          if (!secondTry && res.verdict === "near") { setSecondTry(true); return; }
          answer(false, given); }} className="space-y-3">
          {VERB_LABELS.map((label, i) => (
            <label key={label} className="block space-y-1">
              <span className="text-sm font-semibold">{label}</span>
              <Input ref={(el) => { formRefs.current[i] = el; }} autoFocus={i === 0} autoCapitalize="off" autoCorrect="off" spellCheck={false} disabled={answered !== null}
                value={forms[i]} onFocus={() => setFocusIdx(i)}
                onChange={(e) => { const v = e.target.value; setForms((f) => f.map((x, j) => (j === i ? v : x))); }}
                onKeyDown={(e) => { if (e.key === "Enter" && i < 2 && answered === null) { e.preventDefault(); formRefs.current[i + 1]?.focus(); } }}
                className={`h-12 text-lg ${formsOk && answered !== null ? (formsOk[i] ? "border-primary" : "border-destructive") : ""}`} />
            </label>
          ))}
          <div className="flex flex-wrap gap-1">
            {["ä", "ö", "ü", "ß"].map((ch) => (
              <Button key={ch} type="button" size="sm" variant="secondary" disabled={answered !== null}
                onClick={() => { setForms((f) => f.map((x, j) => (j === focusIdx ? x + ch : x))); formRefs.current[focusIdx]?.focus(); }}>{ch}</Button>
            ))}
          </div>
          {answered === null && secondTry && <p className="rounded-lg bg-secondary p-3 text-center text-sm font-semibold">Presque ! Une lettre ne va pas. Corrige et réessaie.</p>}
          {answered === null && <Button type="submit" size="lg" className="w-full">Valider</Button>}
          {answered === false && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-center">
              <p>Bonne réponse : <b>{word.german}</b></p>
              {formsOk && <p className="text-sm text-muted-foreground">{VERB_LABELS.map((l, i) => `${l} ${formsOk[i] ? "✅" : "❌"}`).join(" · ")}</p>}
            </div>
          )}
          {answered !== null && <Button type="submit" size="lg" className="w-full">Suivant</Button>}
        </form>
      )}
      {((mode === "typing" && !verb) || mode === "dictation") && (
        <form onSubmit={(e) => { e.preventDefault(); if (answered !== null) return next();
          if (isWrittenCorrect(typed, word.german)) return void answer(true, typed);
          if (!secondTry && isNearMiss(typed, word.german)) { setSecondTry(true); return; }
          answer(false, typed); }} className="space-y-3">
          <Input autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false} disabled={answered !== null}
            value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Mot allemand (avec l'article)" className="h-14 text-lg" />
          <div className="flex flex-wrap gap-1">
            {["ä", "ö", "ü", "ß"].map((ch) => (
              <Button key={ch} type="button" size="sm" variant="secondary" disabled={answered !== null} onClick={() => setTyped((t) => t + ch)}>{ch}</Button>
            ))}
          </div>
          {answered === null && secondTry && <p className="rounded-lg bg-secondary p-3 text-center text-sm font-semibold">Presque ! Une lettre ne va pas. Corrige et réessaie.</p>}
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
          {answered === false && isQcm && <p className="text-center">Bonne réponse : <b>{target}</b></p>}
          {mode !== "typing" && mode !== "dictation" && mode !== "context" && <Button size="lg" className="w-full" onClick={next}>Suivant</Button>}
        </>
      )}
    </div>
  );
}
