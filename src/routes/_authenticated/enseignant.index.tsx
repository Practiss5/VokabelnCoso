import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { TeacherOnly } from "@/components/TeacherOnly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/enseignant/")({
  head: () => ({ meta: [{ title: "Espace enseignant — Vocabulaire Allemand" }, { name: "description", content: "Classes et listes de vocabulaire." }, { property: "og:title", content: "Espace enseignant — Vocabulaire Allemand" }, { property: "og:description", content: "Classes et listes de vocabulaire." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => (
    <AppShell>
      <TeacherHome />
    </AppShell>
  ),
});

function TeacherHome() {
  return (
    <TeacherOnly>
      <h1 className="text-4xl font-bold">Espace enseignant</h1>
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <Classes />
        <Lists />
      </div>
    </TeacherOnly>
  );
}

function Classes() {
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name, join_code, profiles(count)").eq("teacher_id", me!.id).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("classes").insert({ name: name.trim(), teacher_id: me!.id });
    if (error) { toast.error(error.message); return; }
    setName("");
    qc.invalidateQueries({ queryKey: ["classes"] });
  }
  return (
    <section className="word-card p-5">
      <h2 className="text-2xl font-bold">Mes classes</h2>
      <form onSubmit={create} className="mt-4 flex gap-2">
        <Input required placeholder="Nom de la classe (ex. 3e B)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit">Créer</Button>
      </form>
      <ul className="mt-4 divide-y">
        {data?.map((c) => (
          <li key={c.id}>
            <Link to="/enseignant/classes/$classId" params={{ classId: c.id }} className="flex items-center justify-between py-3 hover:bg-muted/50">
              <span className="font-medium">{c.name}</span>
              <span className="text-sm text-muted-foreground">
                {(c.profiles as unknown as { count: number }[])[0]?.count ?? 0} élèves · code <b className="font-mono">{c.join_code}</b>
              </span>
            </Link>
          </li>
        ))}
        {data?.length === 0 && <li className="py-3 text-sm text-muted-foreground">Aucune classe pour l'instant.</li>}
      </ul>
    </section>
  );
}

function Lists() {
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const { data } = useQuery({
    queryKey: ["lists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vocab_lists").select("id, title, words(count)").eq("teacher_id", me!.id).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("vocab_lists").insert({ title: title.trim(), teacher_id: me!.id });
    if (error) { toast.error(error.message); return; }
    setTitle("");
    qc.invalidateQueries({ queryKey: ["lists"] });
  }
  return (
    <section className="word-card p-5">
      <h2 className="text-2xl font-bold">Mes listes</h2>
      <form onSubmit={create} className="mt-4 flex gap-2">
        <Input required placeholder="Titre (ex. La maison)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button type="submit">Créer</Button>
      </form>
      <ul className="mt-4 divide-y">
        {data?.map((l) => (
          <li key={l.id}>
            <Link to="/enseignant/listes/$listId" params={{ listId: l.id }} className="flex items-center justify-between py-3 hover:bg-muted/50">
              <span className="font-medium">{l.title}</span>
              <span className="text-sm text-muted-foreground">{(l.words as unknown as { count: number }[])[0]?.count ?? 0} mots</span>
            </Link>
          </li>
        ))}
        {data?.length === 0 && <li className="py-3 text-sm text-muted-foreground">Aucune liste pour l'instant.</li>}
      </ul>
    </section>
  );
}
