import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { DAILY_GOAL, isMastered, REASON_LABELS } from "@/lib/vocab";
import { dailyQuery } from "@/lib/daily";
import { AppShell } from "@/components/AppShell";
import { StudentHomework, StudentStreak } from "@/components/Homework";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/eleve/")({
  head: () => ({ meta: [{ title: "Mes révisions — Vocabulaire Allemand" }, { name: "description", content: "Séance du jour, entraînements et listes à réviser." }, { property: "og:title", content: "Mes révisions — Vocabulaire Allemand" }, { property: "og:description", content: "Séance du jour, entraînements et listes à réviser." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => (
    <AppShell>
      <StudentHome />
    </AppShell>
  ),
});

function StudentHome() {
  const { data: me } = useSuspenseQuery(meQuery);
  if (!me?.classId) return <JoinClass />;
  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-muted-foreground">Hallo{me.fullName ? `, ${me.fullName}` : ""} !</p>
        <h1 className="text-4xl font-bold">Aujourd'hui</h1>
      </div>
      <StudentStreak studentId={me.id} />
      <StudentHomework studentId={me.id} classId={me.classId} />
      <DailyCard />
      <ChooseStep />
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Mes listes</h2>
        <MyLists />
      </section>
    </div>
  );
}

function JoinClass() {
  const [code, setCode] = useState("");
  const qc = useQueryClient();
  async function join(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("join_class", { _code: code });
    if (error) { toast.error(error.message); return; }
    toast.success("Classe rejointe !");
    qc.invalidateQueries();
  }
  return (
    <form onSubmit={join} className="word-card mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-3xl font-bold">Rejoindre ma classe</h1>
      <p className="text-muted-foreground">Entrez le code donné par votre enseignant.</p>
      <Input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="A1B2C3" className="font-mono text-lg" />
      <Button type="submit" className="w-full">Rejoindre</Button>
    </form>
  );
}

function DailyCard() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data } = useQuery(dailyQuery(me!.id, me!.classId!));
  if (!data) return <div className="word-card p-6">Chargement…</div>;
  // Goal adapts to small lists: DAILY_GOAL answers minimum, no daily cap.
  const goal = DAILY_GOAL;
  const pct = Math.min(100, Math.round((data.doneToday / goal) * 100));
  const counts = data.items.reduce<Record<string, number>>((m, i) => ({ ...m, [i.reason]: (m[i.reason] ?? 0) + 1 }), {});
  const minutes = Math.max(5, Math.min(10, Math.round(data.items.length * 0.7)));
  return (
    <section className="word-card space-y-4 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Ma séance du jour</h2>
          <p className="text-sm text-muted-foreground">
            {data.items.length ? `${data.items.length} mots choisis pour vous · environ ${minutes} min` : "Aucun mot à proposer pour l'instant."}
          </p>
        </div>
        {data.items.length > 0 && (
          <Button asChild size="lg" className="mt-3 sm:mt-0"><Link to="/eleve/seance">{pct >= 100 ? "Encore une séance" : "Commencer"}</Link></Button>
        )}
      </div>
      {data.items.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {(["overdue", "fragile", "recent", "new"] as const).filter((r) => counts[r]).map((r) => (
            <span key={r} className="rounded-full bg-secondary px-3 py-1">{REASON_LABELS[r]} : <b>{counts[r]}</b></span>
          ))}
        </div>
      )}
      <div>
        <div className="flex justify-between text-sm"><span>Objectif du jour</span><span className="font-semibold">{data.doneToday}/{goal} réponses</span></div>
        <div className="mt-1 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        {pct >= 100 && <p className="mt-1 text-sm font-semibold text-success">Objectif atteint, bravo ! ✓</p>}
      </div>
    </section>
  );
}

function MyLists() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data } = useQuery({
    queryKey: ["my-lists"],
    queryFn: async () => {
      const { data: a } = await supabase.from("list_assignments").select("vocab_lists(id, title, words(id))").eq("class_id", me!.classId!);
      const { data: prog } = await supabase.from("word_progress").select("word_id, due_at, repetitions").eq("student_id", me!.id);
      const { data: skills } = await supabase.from("skill_progress").select("word_id, skill, step").eq("student_id", me!.id);
      const pm = new Map((prog ?? []).map((p) => [p.word_id, p]));
      const now = Date.now();
      return (a ?? []).map((x) => x.vocab_lists).filter(Boolean).map((l) => {
        const words = l!.words as { id: string }[];
        const due = words.filter((w) => { const p = pm.get(w.id); return !p || new Date(p.due_at).getTime() <= now; }).length;
        const mastered = words.filter((w) => isMastered((skills ?? []).filter((s) => s.word_id === w.id))).length;
        return { id: l!.id, title: l!.title, total: words.length, due, mastered };
      });
    },
  });
  if (!data) return <p>Chargement…</p>;
  if (!data.length) return <p className="rounded-lg bg-secondary p-4">Aucune liste attribuée à votre classe pour l'instant.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {data.map((l) => (
        <Link key={l.id} to="/eleve/reviser/$listId" params={{ listId: l.id }} className="word-card block p-5 transition-transform hover:-translate-y-0.5">
          <h2 className="text-2xl font-bold">{l.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{l.total} mots · {l.mastered} maîtrisés</p>
          <p className="mt-3 inline-block rounded-full bg-accent px-3 py-1 text-sm font-semibold">
            {l.due > 0 ? `${l.due} à réviser` : "À jour ✓"}
          </p>
        </Link>
      ))}
    </div>
  );
}

const STEPS = [
  { mode: "flashcard", title: "🃏 Cartes" },
  { mode: "choice", title: "🔠 QCM" },
  { mode: "speaking", title: "🎙️ Prononciation" },
  { mode: "typing", title: "✍️ Écriture" },
  { mode: "context", title: "🧩 Phrases à trou" },
  { mode: "dictation", title: "🎧 Dictée" },
] as const;

/** Lets the student pick one exercise type over all class words, besides the daily session. */
function ChooseStep() {
  const [game, setGame] = useState<null | "match" | "tetris">(null);
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Choisir mon entraînement</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <Link key={s.mode} to="/eleve/seance" search={{ mode: s.mode }} className="word-card p-4 text-center text-lg font-bold transition-transform hover:-translate-y-0.5">{s.title}</Link>
        ))}
        <button onClick={() => setGame((g) => (g === "match" ? null : "match"))} className="word-card border-2 border-accent p-4 text-center text-lg font-bold transition-transform hover:-translate-y-0.5">⚡ Cartes à relier</button>
        <button onClick={() => setGame((g) => (g === "tetris" ? null : "tetris"))} className="word-card border-2 border-primary p-4 text-center text-lg font-bold transition-transform hover:-translate-y-0.5">🧱 Wort-Tetris</button>
      </div>
      {game && <GameLists tetris={game === "tetris"} />}
    </section>
  );
}

function GameLists({ tetris }: { tetris: boolean }) {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data } = useQuery({
    queryKey: ["game-lists", me!.classId],
    queryFn: async () => {
      const { data } = await supabase.from("list_assignments").select("vocab_lists(id, title)").eq("class_id", me!.classId!);
      return (data ?? []).map((x) => x.vocab_lists).filter(Boolean) as { id: string; title: string }[];
    },
  });
  if (!data) return <p>Chargement…</p>;
  return (
    <div className="rounded-lg bg-secondary p-4">
      <p className="mb-2 text-sm">Sur quelle liste veux-tu jouer ?</p>
      <div className="flex flex-wrap gap-2">
        {data.map((l) => (
          <Button key={l.id} asChild variant="outline"><Link to="/eleve/reviser/$listId" params={{ listId: l.id }} search={tetris ? { tetris: true } : { jeu: true }}>{l.title}</Link></Button>
        ))}
        {!data.length && <span className="text-sm text-muted-foreground">Aucune liste pour l'instant.</span>}
      </div>
    </div>
  );
}
