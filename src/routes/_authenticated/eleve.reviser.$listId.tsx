import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { buildHomeworkPractice, homeworkStatus, nextHomeworkMode, hasCloze, hwSession, orderQueue, type HwRequirements, type DailyMode, type Word } from "@/lib/vocab";
import { fetchAllReviews } from "@/lib/fetch-all";
import { flushAnswers, pendingCount } from "@/lib/answer-queue";
import { ReviewSession, type SessionItem } from "@/components/ReviewSession";
import { MatchGame } from "@/components/MatchGame";
import { WortTetris } from "@/components/WortTetris";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useHomeworkTimer, useActiveHomeworkId } from "@/lib/study-time";

type Mode = "flashcard" | "choice" | "speaking" | "typing" | "context" | "dictation" | "listen" | "choice_de_fr" | "choice_fr_de" | "listen_de_fr" | "listen_fr_de";
const SKILL_OF_MODE = { flashcard: "recognition", choice: "translation", listen: "translation", speaking: "speaking", typing: "writing", context: "context", dictation: "writing" } as const;

export const Route = createFileRoute("/_authenticated/eleve/reviser/$listId")({
  validateSearch: (s: Record<string, unknown>): { jeu?: boolean; tetris?: boolean; devoir?: string; exo?: Mode } => ({
    ...(s['jeu'] === true || s['jeu'] === "true" ? { jeu: true } : {}),
    ...(s['tetris'] === true || s['tetris'] === "true" ? { tetris: true } : {}),
    ...(typeof s['devoir'] === "string" ? { devoir: s['devoir'] } : {}),
    ...(ALL_MODES.some((m) => m.id === s['exo']) ? { exo: s['exo'] as Mode } : {}),
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
  { id: "listen", title: "QCM audio 🔊", desc: "Écoutez et choisissez la bonne réponse parmi trois." },
];
// Exercises that exist only in homework (fixed direction).
const HW_ONLY: { id: Mode; title: string; desc: string }[] = [
  { id: "choice_de_fr", title: "QCM Allemand → Français", desc: "Le mot allemand s'affiche : choisissez la traduction française." },
  { id: "choice_fr_de", title: "QCM Français → Allemand", desc: "Le mot français s'affiche : choisissez le mot allemand." },
  { id: "listen_de_fr", title: "QCM audio Allemand → Français 🔊", desc: "Écoutez le mot allemand (sans le voir) et choisissez le français parmi trois." },
  { id: "listen_fr_de", title: "QCM audio Français → Allemand 🔊", desc: "Le mot français s'affiche : écoutez trois mots allemands et choisissez le bon." },
];
const ALL_MODES = [...MODES, ...HW_ONLY];

function Review() {
  const { listId } = Route.useParams();
  const { data: me } = useSuspenseQuery(meQuery);
  const [mode, setMode] = useState<Mode | null>(null);
  const [session, setSession] = useState<{ items: SessionItem[]; pool: Word[]; caughtUp: boolean } | null>(null);
  const [sessionNumber, setSessionNumber] = useState(0);
  const [title, setTitle] = useState("");
  const [matchWords, setMatchWords] = useState<{ id: string; german: string; french: string }[] | null>(null);
  const { devoir, exo } = Route.useSearch();
  useHomeworkTimer(useActiveHomeworkId(listId, devoir));
  // Homework: only its words and its required exercises.
  const [hw, setHw] = useState<{ word_ids: string[] | null; modes: Mode[]; req: HwRequirements | null; created_at: string; due_at: string } | null>(null);
  useEffect(() => {
    if (!devoir) { setHw(null); return; }
    void supabase.from("homeworks").select("word_ids, requirements, created_at, due_at").eq("id", devoir).eq("list_id", listId).maybeSingle().then(({ data }) => {
      if (!data) return;
      const req = (data.requirements ?? null) as HwRequirements | null;
      setHw({ word_ids: data.word_ids, req, created_at: data.created_at, due_at: data.due_at, modes: req ? ALL_MODES.map((m) => m.id).filter((id) => (req as Record<string, unknown>)[id] != null) : ["choice", "typing"] });
    });
  }, [devoir]);
  // "Continuer mon devoir": open the first unfinished exercise directly, once the homework is loaded.
  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    if (exo && hw && !autoStarted && hw.modes.includes(exo)) { setAutoStarted(true); void start(exo); }
  }, [exo, hw]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start(m: Mode) {
    if (!me || (devoir && !hw)) return;
    const sm = hw ? hwSession(m, hw.req) : { mode: m as DailyMode, dirs: [undefined] };
    const [list, words, prog] = await Promise.all([
      supabase.from("vocab_lists").select("title").eq("id", listId).single(),
      supabase.from("words").select("id, german, french, example_de, example_fr").eq("list_id", listId),
      // Each mode schedules its own skill: a QCM success does not delay the writing review.
      supabase.from("skill_progress").select("word_id, due_at, step, wrong_count, correct_count")
         .eq("student_id", me.id).eq("skill", SKILL_OF_MODE[sm.mode as keyof typeof SKILL_OF_MODE] ?? "translation"),
    ]);
    if (list.error || !words.data?.length) { toast.error("Liste introuvable ou vide"); return; }
    const hwIds = hw?.word_ids?.length ? new Set(hw.word_ids) : null;
    const base = hwIds ? words.data.filter((w) => hwIds.has(w.id)) : words.data;
    const usable = m === "context" ? base.filter(hasCloze) : base;
    if (!usable.length) { toast.error("Cette liste n'a pas encore de phrases d'exemple."); return; }
    const progress = (prog.data ?? []).map((p) => ({ ...p, repetitions: p.step }));
    const { queue, caughtUp } = orderQueue(usable, progress, new Date());
    let items: SessionItem[] = sm.dirs.flatMap((dir) => queue.map((word) => ({ word, mode: sm.mode, dir })));
    if (hw) {
      try {
        const reviews = await fetchAllReviews((from, to) => supabase.from("reviews").select("word_id, created_at, mode, correct, homework_id")
          .eq("student_id", me.id).gte("created_at", hw.created_at).order("created_at").order("id").range(from, to));
        items = buildHomeworkPractice(usable, reviews, m, hw.req, hw.created_at, hw.due_at, devoir);
      } catch { toast.error("Impossible de charger la progression du devoir. Réessaie."); return; }
    }
    setTitle(list.data.title);
    setSession({ items, pool: words.data, caughtUp: !hw && caughtUp });
    setSessionNumber((n) => n + 1);
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
          {(hw ? ALL_MODES.filter((m) => hw.modes.includes(m.id)).map((m) => m.id === "choice" && hwSession("choice", hw.req).dirs.length > 1 ? { ...m, title: "QCM mixte", desc: "Chaque mot dans les deux sens : allemand → français puis français → allemand." } : m) : MODES).map((m) => (
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
    <ReviewSession key={sessionNumber} title={title} {...(hw && devoir ? { homeworkId: devoir } : {})} pool={session.pool} onQuit={() => setMode(null)}
      items={session.items}
      notice={session.caughtUp ? "Tout est à jour ! Entraînement libre sur les mots les plus proches de leur révision." : undefined}
      endActions={hw && devoir && me ? <HomeworkEndActions studentId={me.id} homeworkId={devoir} sessionNumber={sessionNumber} hw={hw}
        words={session.pool.filter((w) => !hw.word_ids?.length || hw.word_ids.includes(w.id))}
        onContinue={(m) => void start(m)} onChoose={() => setMode(null)} /> : <Button onClick={() => setMode(null)}>Choisir un autre mode</Button>} />
  );
}

function HomeworkEndActions({ studentId, homeworkId, sessionNumber, hw, words, onContinue, onChoose }: {
  studentId: string; homeworkId: string; sessionNumber: number; hw: { created_at: string; due_at: string; req: HwRequirements | null };
  words: Word[]; onContinue: (m: Mode) => void; onChoose: () => void;
}) {
  const [opening, setOpening] = useState(false);
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ["homework-continuation", homeworkId, studentId, sessionNumber, hw, words.map((w) => w.id)],
    staleTime: 0, gcTime: 0, refetchOnMount: "always", refetchInterval: 15000,
    queryFn: async () => {
      await flushAnswers();
      if (pendingCount(studentId)) return { pending: true, next: null, done: false };
      const reviews = await fetchAllReviews((from, to) => supabase.from("reviews").select("word_id, created_at, mode, correct, homework_id")
        .eq("student_id", studentId).gte("created_at", hw.created_at).order("created_at").order("id").range(from, to));
      const status = homeworkStatus(words.map((w) => w.id), reviews, hw.created_at, hw.due_at, hw.req, homeworkId);
      return { pending: false, next: nextHomeworkMode(status.parts), done: status.done };
    },
  });
  return <>
    {data?.done && !isFetching && !error ? <Button asChild><Link to="/eleve">Devoir terminé ! 🎉</Link></Button> :
      <Button disabled={isPending || opening || data?.pending} onClick={async () => {
        setOpening(true);
        try {
          const result = await refetch();
          if (result.error || !result.data || result.data.pending) return;
          const next = ALL_MODES.find((m) => m.id === result.data.next);
          if (next) onContinue(next.id);
        } finally { setOpening(false); }
      }}>{isPending ? "Vérification du devoir…" : data?.pending ? "Réponses en attente de connexion" : "Continuer mes devoirs"}</Button>}
    {error && <p className="text-sm text-destructive">Progression indisponible. Réessaie avec le bouton Continuer.</p>}
    <Button variant="outline" onClick={onChoose}>Choisir un autre mode</Button>
  </>;
}

