import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { DAILY_GOAL, isMastered, REASON_LABELS } from "@/lib/vocab";
import { dailyQuery } from "@/lib/daily";
import { AppShell } from "@/components/AppShell";
import { hasPendingHomework, myHomeworksQuery, StudentHomework, StudentStreak } from "@/components/Homework";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { selectTrainingList, trainingListsQuery } from "@/lib/training-lists";

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
      <DailyIfNoHomework studentId={me.id} classId={me.classId} />
      <ChooseStep />
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Mes listes</h2>
        <MyLists />
      </section>
    </div>
  );
}

/** Hides the daily session while homework is still to do, so students do their homework first. */
function DailyIfNoHomework({ studentId, classId }: { studentId: string; classId: string }) {
  const { data } = useQuery(myHomeworksQuery(studentId, classId));
  if (!data || hasPendingHomework(data)) return null;
  return <DailyCard />;
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
  const { data: lists } = useQuery(trainingListsQuery(me?.classId ?? ""));
  const [chosenList, setChosenList] = useState<string>();
  const listId = selectTrainingList(lists ?? [], chosenList);
  const { data } = useQuery({ ...dailyQuery(me?.id ?? "", me?.classId ?? "", listId), enabled: Boolean(me?.classId && lists) });
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
          <Button asChild size="lg" className="mt-3 sm:mt-0"><Link to="/eleve/seance" search={{ listId }}>{pct >= 100 ? "Encore une séance" : "Commencer"}</Link></Button>
        )}
      </div>
      <TrainingListChoice id="daily-list" lists={lists} listId={listId} onChange={setChosenList} />
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
  { mode: "listen", title: "🔊 QCM audio" },
] as const;

function TrainingListChoice({ id, lists, listId, onChange }: {
  id: string; lists: { id: string; title: string }[] | undefined; listId: string | undefined; onChange: (id: string) => void;
}) {
  return <div className="max-w-lg space-y-2">
    <label htmlFor={id} className="text-sm font-semibold">Liste de vocabulaire</label>
    <Select value={listId ?? ""} onValueChange={onChange} disabled={!lists?.length}>
      <SelectTrigger id={id}><SelectValue placeholder={lists ? "Aucune liste attribuée" : "Chargement…"} /></SelectTrigger>
      <SelectContent>{lists?.map((list) => <SelectItem key={list.id} value={list.id}>{list.title}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}

/** Lets the student pick one exercise type over all class words, besides the daily session. */
function ChooseStep() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: lists } = useQuery(trainingListsQuery(me?.classId ?? ""));
  const [chosenList, setChosenList] = useState<string>();
  const listId = selectTrainingList(lists ?? [], chosenList);
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Choisir mon entraînement</h2>
      <TrainingListChoice id="training-list" lists={lists} listId={listId} onChange={setChosenList} />
      {listId && <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <Link key={s.mode} to="/eleve/seance" search={{ mode: s.mode, listId }} className="word-card p-4 text-center text-lg font-bold transition-transform hover:-translate-y-0.5">{s.title}</Link>
        ))}
        <Link to="/eleve/reviser/$listId" params={{ listId }} search={{ jeu: true }} className="word-card border-2 border-accent p-4 text-center text-lg font-bold transition-transform hover:-translate-y-0.5">⚡ Cartes à relier</Link>
        <Link to="/eleve/reviser/$listId" params={{ listId }} search={{ tetris: true }} className="word-card border-2 border-primary p-4 text-center text-lg font-bold transition-transform hover:-translate-y-0.5">🧱 Wort-Tetris</Link>
      </div>
      </>}
    </section>
  );
}
