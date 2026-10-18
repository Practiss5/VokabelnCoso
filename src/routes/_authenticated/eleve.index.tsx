import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { ERROR_LABELS, isMastered, MODE_LABELS } from "@/lib/vocab";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/eleve/")({
  head: () => ({ meta: [{ title: "Mes révisions — Vocabulaire Allemand" }, { name: "description", content: "Listes à réviser et historique." }] }),
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
        <h1 className="text-4xl font-bold">Mes listes</h1>
      </div>
      <MyLists />
      <History />
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

function History() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data } = useQuery({
    queryKey: ["history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("id, mode, correct, error_type, created_at, words(german, french)")
        .eq("student_id", me!.id).order("created_at", { ascending: false }).limit(40);
      if (error) throw error;
      return data;
    },
  });
  const total = data?.length ?? 0;
  const ok = data?.filter((r) => r.correct).length ?? 0;
  return (
    <section>
      <h2 className="text-2xl font-bold">Historique récent</h2>
      {total > 0 && <p className="mt-1 text-sm text-muted-foreground">{ok}/{total} bonnes réponses sur les dernières révisions</p>}
      <ul className="word-card mt-4 divide-y">
        {data?.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
            <span><b>{r.words?.german}</b> <span className="text-muted-foreground">— {r.words?.french}</span></span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">{MODE_LABELS[r.mode]}{r.error_type ? ` · ${ERROR_LABELS[r.error_type] ?? ""}` : ""} · {new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
              <span className={r.correct ? "font-bold text-success" : "font-bold text-destructive"}>{r.correct ? "✓" : "✗"}</span>
            </span>
          </li>
        ))}
        {total === 0 && <li className="p-4 text-sm text-muted-foreground">Pas encore de révision.</li>}
      </ul>
    </section>
  );
}
