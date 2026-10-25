import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { hasCloze, orderQueue, type Word } from "@/lib/vocab";
import { ReviewSession } from "@/components/ReviewSession";
import { MatchGame } from "@/components/MatchGame";
import { WortTetris } from "@/components/WortTetris";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

type Mode = "flashcard" | "choice" | "speaking" | "typing" | "context" | "dictation";
const SKILL_OF_MODE = { flashcard: "recognition", choice: "translation", speaking: "speaking", typing: "writing", context: "context", dictation: "writing" } as const;

export const Route = createFileRoute("/_authenticated/eleve/reviser/$listId")({
  validateSearch: (s: Record<string, unknown>): { jeu?: boolean; tetris?: boolean; devoir?: string } => ({
    ...(s['jeu'] === true || s['jeu'] === "true" ? { jeu: true } : {}),
    ...(s['tetris'] === true || s['tetris'] === "true" ? { tetris: true } : {}),
    ...(typeof s['devoir'] === "string" ? { devoir: s['devoir'] } : {}),
  }),
  head: () => ({ meta: [{ title: "Réviser — Vocabulaire Allemand" }, { name: "description", content: "Séance de révision." }, { property: "og:title", content: "Réviser — Vocabulaire Allemand" }, { property: "og:description", content: "Séance de révision." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => (
    <AppShell>
      <Review />
    </AppShell>
  ),
});

const MODES: { id: Mode; title: string; desc: string }[] = [
  { id: "flashcard", title: "Cartes", desc: "Le mot allemand s'affiche : le connaissez-vous ?" },
  { id: "choice", title: "QCM", desc: "Choisissez la bonne traduction parmi quatre." },
  { id: "speaking", title: "Prononciation 🎙️", desc: "Le mot français s'affiche : dites-le en allemand, avec l'article." },
  { id: "typing", title: "Écriture", desc: "Écrivez le mot allemand à partir du français." },
  { id: "context", title: "Phrases à trou", desc: "Complétez une phrase allemande avec le bon mot." },
  { id: "dictation", title: "Dictée 🎧", desc: "Écoutez le mot allemand (sans le voir) et écrivez-le." },
];

function Review() {
  const { listId } = Route.useParams();
  const { data: me } = useSuspenseQuery(meQuery);
  const [mode, setMode] = useState<Mode | null>(null);
  const [session, setSession] = useState<{ words: Word[]; pool: Word[]; caughtUp: boolean } | null>(null);
  const [title, setTitle] = useState("");
  const [matchWords, setMatchWords] = useState<{ id: string; german: string; french: string }[] | null>(null);
  const { devoir } = Route.useSearch();
  // Homework: only its words and its required exercises.
  const [hw, setHw] = useState<{ word_ids: string[] | null; modes: Mode[] } | null>(null);
  useEffect(() => {
    if (!devoir) { setHw(null); return; }
    void supabase.from("homeworks").select("word_ids, requirements").eq("id", devoir).maybeSingle().then(({ data }) => {
      if (!data) return;
      const req = (data.requirements ?? null) as Record<string, number> | null;
      setHw({ word_ids: data.word_ids, modes: req ? MODES.map((m) => m.id).filter((id) => req[id] != null) : MODES.map((m) => m.id) });
    });
  }, [devoir]);

  async function start(m: Mode) {
    const [list, words, prog] = await Promise.all([
      supabase.from("vocab_lists").select("title").eq("id", listId).single(),
      supabase.from("words").select("id, german, french, example_de, example_fr").eq("list_id", listId),
      // Each mode schedules its own skill: a QCM success does not delay the writing review.
      supabase.from("skill_progress").select("word_id, due_at, step, wrong_count, correct_count")
        .eq("student_id", me!.id).eq("skill", SKILL_OF_MODE[m]),
    ]);
    if (list.error || !words.data?.length) { toast.error("Liste introuvable ou vide"); return; }
    const hwIds = hw?.word_ids?.length ? new Set(hw.word_ids) : null;
    const base = hwIds ? words.data.filter((w) => hwIds.has(w.id)) : words.data;
    const usable = m === "context" ? base.filter(hasCloze) : base;
    if (!usable.length) { toast.error("Cette liste n'a pas encore de phrases d'exemple."); return; }
    const progress = (prog.data ?? []).map((p) => ({ ...p, repetitions: p.step }));
    const { queue, caughtUp } = orderQueue(usable, progress, new Date());
    setTitle(list.data.title);
    setSession({ words: queue, pool: words.data, caughtUp });
    setMode(m);
  }

  async function startMatch() {
    const { data } = await supabase.from("words").select("id, german, french").eq("list_id", listId);
    if (!data || data.length < 2) { toast.error("Il faut au moins 2 mots dans la liste."); return; }
    setMatchWords(data);
  }

  const { jeu, tetris: tetrisSearch } = Route.useSearch();
  const [tetris, setTetris] = useState(false);
  useEffect(() => { if (tetrisSearch) setTetris(true); }, [tetrisSearch]);
  useEffect(() => { if (jeu) void startMatch(); }, [jeu]); // eslint-disable-line react-hooks/exhaustive-deps

  if (tetris) return <WortTetris listId={listId} onQuit={() => setTetris(false)} />;
  if (matchWords) return <MatchGame listId={listId} words={matchWords} onQuit={() => setMatchWords(null)} />;

  if (!mode || !session)
    return (
      <div className="space-y-6">
        <Link to="/eleve" className="text-sm underline">← Mes listes</Link>
        <h1 className="text-4xl font-bold">{hw ? "Mon devoir" : "Choisir un mode"}</h1>
        {hw && <p className="text-sm text-muted-foreground">Fais chacun de ces exercices pour valider ton devoir{hw.word_ids?.length ? ` (${hw.word_ids.length} mots choisis par ton enseignant)` : ""}.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {MODES.filter((m) => !hw || hw.modes.includes(m.id)).map((m) => (
            <button key={m.id} onClick={() => start(m.id)} className="word-card p-5 text-left transition-transform hover:-translate-y-0.5">
              <h2 className="text-2xl font-bold">{m.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
            </button>
          ))}
          {!hw && <>
          <button onClick={startMatch} className="word-card border-2 border-accent p-5 text-left transition-transform hover:-translate-y-0.5">
            <h2 className="text-2xl font-bold">Cartes à relier ⚡</h2>
            <p className="mt-2 text-sm text-muted-foreground">Reliez les paires sans vous tromper et battez le record de la classe. (Ne compte pas pour les devoirs.)</p>
          </button>
          <button onClick={() => setTetris(true)} className="word-card border-2 border-primary p-5 text-left transition-transform hover:-translate-y-0.5">
            <h2 className="text-2xl font-bold">Wort-Tetris 🧱</h2>
            <p className="mt-2 text-sm text-muted-foreground">Jeu d'arcade : traduction, prononciation, orthographe et boss. (Ne compte pas pour les devoirs.)</p>
          </button>
          </>}
        </div>
      </div>
    );

  return (
    <ReviewSession key={mode} title={title} pool={session.pool} onQuit={() => setMode(null)}
      items={session.words.map((word) => ({ word, mode }))}
      notice={session.caughtUp ? "Tout est à jour ! Entraînement libre sur les mots les plus proches de leur révision." : undefined}
      endActions={<Button onClick={() => setMode(null)}>Choisir un autre mode</Button>} />
  );
}

