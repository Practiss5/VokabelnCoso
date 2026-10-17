import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { buildChoices, isAnswerCorrect, orderQueue, type Word } from "@/lib/vocab";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "flashcard" | "choice" | "typing";

export const Route = createFileRoute("/_authenticated/eleve/reviser/$listId")({
  head: () => ({ meta: [{ title: "Réviser — Vocabulaire Allemand" }, { name: "description", content: "Séance de révision." }] }),
  component: () => (
    <AppShell>
      <Review />
    </AppShell>
  ),
});

const MODES: { id: Mode; title: string; desc: string }[] = [
  { id: "flashcard", title: "Cartes", desc: "Le mot allemand s'affiche : le connaissez-vous ?" },
  { id: "choice", title: "QCM", desc: "Choisissez la bonne traduction parmi quatre." },
  { id: "typing", title: "Écriture", desc: "Écrivez le mot allemand à partir du français." },
];

function Review() {
  const { listId } = Route.useParams();
  const { data: me } = useSuspenseQuery(meQuery);
  const [mode, setMode] = useState<Mode | null>(null);
  const [session, setSession] = useState<{ words: Word[]; pool: Word[]; caughtUp: boolean } | null>(null);
  const [title, setTitle] = useState("");

  async function start(m: Mode) {
    const [list, words, prog] = await Promise.all([
      supabase.from("vocab_lists").select("title").eq("id", listId).single(),
      supabase.from("words").select("id, german, french").eq("list_id", listId),
      supabase.from("word_progress").select("word_id, due_at, repetitions, wrong_count, correct_count").eq("student_id", me!.id),
    ]);
    if (list.error || !words.data?.length) return toast.error("Liste introuvable ou vide");
    const { queue, caughtUp } = orderQueue(words.data, prog.data ?? [], new Date());
    setTitle(list.data.title);
    setSession({ words: queue, pool: words.data, caughtUp });
    setMode(m);
  }

  if (!mode || !session)
    return (
      <div className="space-y-6">
        <Link to="/eleve" className="text-sm underline">← Mes listes</Link>
        <h1 className="text-4xl font-bold">Choisir un mode</h1>
        <div className="grid gap-4 sm:grid-cols-3">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => start(m.id)} className="word-card p-5 text-left transition-transform hover:-translate-y-0.5">
              <h2 className="text-2xl font-bold">{m.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );

  return <Session key={mode} mode={mode} title={title} {...session} onQuit={() => setMode(null)} />;
}

function Session({ mode, title, words, pool, caughtUp, onQuit }: { mode: Mode; title: string; words: Word[]; pool: Word[]; caughtUp: boolean; onQuit: () => void }) {
  const qc = useQueryClient();
  const [queue, setQueue] = useState(words);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<null | boolean>(null);
  const [score, setScore] = useState({ ok: 0, ko: 0 });
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const retried = useRef(new Set<string>());
  const word = queue[index];
  const choices = useMemo(() => (word ? buildChoices(word, pool) : []), [word, pool]);

  async function answer(correct: boolean) {
    if (answered !== null) return;
    setAnswered(correct);
    setScore((s) => (correct ? { ...s, ok: s.ok + 1 } : { ...s, ko: s.ko + 1 }));
    // Missed words come back once more at the end of the session.
    if (!correct && !retried.current.has(word.id)) {
      retried.current.add(word.id);
      setQueue((q) => [...q, word]);
    }
    const { error } = await supabase.rpc("record_answer", { _word: word.id, _mode: mode, _correct: correct });
    if (error) toast.error("Réponse non enregistrée : " + error.message);
  }
  function next() {
    setAnswered(null); setTyped(""); setPicked(null); setIndex((i) => i + 1);
  }

  if (!word) {
    qc.invalidateQueries({ queryKey: ["my-lists"] });
    qc.invalidateQueries({ queryKey: ["history"] });
    return (
      <div className="word-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-4xl font-bold">Gut gemacht !</h1>
        <p className="mt-4 text-lg">{score.ok} bonnes réponses · {score.ko} erreurs</p>
        <p className="mt-2 text-sm text-muted-foreground">Vos progrès sont enregistrés. Les mots ratés reviendront bientôt.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={onQuit}>Choisir un autre mode</Button>
          <Button asChild variant="outline"><Link to="/eleve">Mes listes</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between text-sm">
        <button className="underline" onClick={onQuit}>← Quitter</button>
        <span className="text-muted-foreground">{title} · {index + 1}/{queue.length}</span>
      </div>
      {caughtUp && index === 0 && (
        <p className="rounded-lg bg-secondary p-3 text-sm">Tout est à jour ! Entraînement libre sur les mots les plus proches de leur révision.</p>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-accent transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>

      <div className="word-card paper-lines flex min-h-48 flex-col items-center justify-center p-8 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{mode === "typing" ? "Français" : "Deutsch"}</p>
        <p className="mt-2 font-display text-4xl font-bold sm:text-5xl">{mode === "typing" ? word.french : word.german}</p>
        {mode === "flashcard" && answered !== null && <p className="mt-4 text-xl">{word.french}</p>}
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
              <button key={c} disabled={answered !== null} onClick={() => { setPicked(c); answer(c === word.french); }}
                className={`word-card min-h-14 px-4 py-3 text-left text-lg font-medium ${state}`}>
                {c}
              </button>
            );
          })}
        </div>
      )}

      {mode === "typing" && (
        <form onSubmit={(e) => { e.preventDefault(); if (answered === null) answer(isAnswerCorrect(typed, word.german)); else next(); }} className="space-y-3">
          <Input autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false} disabled={answered !== null}
            value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Mot allemand (avec l'article)" className="h-14 text-lg" />
          <div className="flex flex-wrap gap-1">
            {["ä", "ö", "ü", "ß"].map((ch) => (
              <Button key={ch} type="button" size="sm" variant="secondary" disabled={answered !== null} onClick={() => setTyped((t) => t + ch)}>{ch}</Button>
            ))}
          </div>
          {answered === null && <Button type="submit" size="lg" className="w-full">Valider</Button>}
          {answered === false && <p className="text-center">Réponse attendue : <b>{word.german}</b></p>}
          {answered !== null && <Button type="submit" size="lg" className="w-full">Suivant</Button>}
        </form>
      )}

      {answered !== null && (
        <>
          <p className={`text-center text-lg font-bold ${answered ? "text-success" : "text-destructive"}`}>
            {answered ? "Richtig ! ✓" : "Pas encore… ✗"}
          </p>
          {mode !== "typing" && <Button size="lg" className="w-full" onClick={next}>Suivant</Button>}
        </>
      )}
    </div>
  );
}
