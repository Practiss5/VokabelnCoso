import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { TeacherOnly } from "@/components/TeacherOnly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/enseignant/listes/$listId")({
  head: () => ({ meta: [{ title: "Liste de vocabulaire — Vocabulaire Allemand" }, { name: "description", content: "Modifier une liste de vocabulaire." }] }),
  component: () => (
    <AppShell>
      <TeacherOnly>
        <ListEditor />
      </TeacherOnly>
    </AppShell>
  ),
});

function ListEditor() {
  const { listId } = Route.useParams();
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const key = ["list", listId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [list, words, classes, assigned] = await Promise.all([
        supabase.from("vocab_lists").select("id, title").eq("id", listId).single(),
        supabase.from("words").select("id, german, french").eq("list_id", listId).order("created_at"),
        supabase.from("classes").select("id, name").eq("teacher_id", me!.id).order("name"),
        supabase.from("list_assignments").select("class_id").eq("list_id", listId),
      ]);
      if (list.error) throw list.error;
      return { list: list.data, words: words.data ?? [], classes: classes.data ?? [], assigned: new Set((assigned.data ?? []).map((a) => a.class_id)) };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const [de, setDe] = useState("");
  const [fr, setFr] = useState("");
  const [bulk, setBulk] = useState("");

  async function addWord(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("words").insert({ list_id: listId, german: de.trim(), french: fr.trim() });
    if (error) { toast.error(error.message); return; }
    setDe(""); setFr(""); refresh();
  }
  async function addBulk() {
    const rows = bulk.split("\n").map((l) => l.split(/[;\t=]/)).map((p) => ({ list_id: listId, german: (p[0] ?? "").trim(), french: (p[1] ?? "").trim() }))
      .filter((r) => r.german && r.french);
    if (!rows.length) { toast.error("Aucune ligne valide (format : allemand ; français)"); return; }
    const { error } = await supabase.from("words").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} mots ajoutés`);
    setBulk(""); refresh();
  }
  async function toggleClass(classId: string, on: boolean) {
    const { error } = on
      ? await supabase.from("list_assignments").insert({ list_id: listId, class_id: classId })
      : await supabase.from("list_assignments").delete().eq("list_id", listId).eq("class_id", classId);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function deleteList() {
    if (!confirm("Supprimer cette liste et tous ses mots ?")) return;
    const { error } = await supabase.from("vocab_lists").delete().eq("id", listId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["lists"] });
    navigate({ to: "/enseignant" });
  }
  async function rename(title: string) {
    if (!title.trim() || title === data?.list.title) return;
    const { error } = await supabase.from("vocab_lists").update({ title: title.trim() }).eq("id", listId);
    if (error) toast.error(error.message); else { toast.success("Titre enregistré"); refresh(); }
  }

  if (!data) return <p>Chargement…</p>;

  return (
    <div className="space-y-8">
      <Link to="/enseignant" className="text-sm underline">← Retour</Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input defaultValue={data.list.title} onBlur={(e) => rename(e.target.value)} className="h-auto border-0 bg-transparent px-0 font-display text-4xl font-bold shadow-none" />
        <Button variant="destructive" onClick={deleteList}>Supprimer la liste</Button>
      </div>

      <section className="word-card p-5">
        <h2 className="text-xl font-bold">Attribuer aux classes</h2>
        <div className="mt-3 flex flex-wrap gap-4">
          {data.classes.map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <Checkbox checked={data.assigned.has(c.id)} onCheckedChange={(v) => toggleClass(c.id, v === true)} />
              {c.name}
            </label>
          ))}
          {data.classes.length === 0 && <p className="text-sm text-muted-foreground">Créez d'abord une classe.</p>}
        </div>
      </section>

      <section className="word-card p-5">
        <h2 className="text-xl font-bold">Mots ({data.words.length})</h2>
        <form onSubmit={addWord} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input required placeholder="Allemand (ex. das Haus)" value={de} onChange={(e) => setDe(e.target.value)} />
          <Input required placeholder="Français (ex. la maison)" value={fr} onChange={(e) => setFr(e.target.value)} />
          <Button type="submit">Ajouter</Button>
        </form>
        <ul className="mt-4 divide-y">
          {data.words.map((w) => <WordRow key={w.id} word={w} onChange={refresh} />)}
        </ul>
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium">Ajouter plusieurs mots d'un coup</summary>
          <p className="mt-2 text-sm text-muted-foreground">Un mot par ligne : <code>der Hund ; le chien</code></p>
          <Textarea rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} className="mt-2" />
          <Button className="mt-2" variant="secondary" onClick={addBulk}>Importer</Button>
        </details>
      </section>
    </div>
  );
}

function WordRow({ word, onChange }: { word: { id: string; german: string; french: string }; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [de, setDe] = useState(word.german);
  const [fr, setFr] = useState(word.french);
  async function save() {
    const { error } = await supabase.from("words").update({ german: de.trim(), french: fr.trim() }).eq("id", word.id);
    if (error) { toast.error(error.message); return; }
    setEditing(false); onChange();
  }
  async function remove() {
    if (!confirm(`Supprimer « ${word.german} » ?`)) return;
    const { error } = await supabase.from("words").delete().eq("id", word.id);
    if (error) { toast.error(error.message); return; }
    onChange();
  }
  if (editing)
    return (
      <li className="grid gap-2 py-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <Input value={de} onChange={(e) => setDe(e.target.value)} />
        <Input value={fr} onChange={(e) => setFr(e.target.value)} />
        <Button size="sm" onClick={save}>OK</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</Button>
      </li>
    );
  return (
    <li className="flex items-center justify-between gap-2 py-2">
      <span><b>{word.german}</b> <span className="text-muted-foreground">— {word.french}</span></span>
      <span className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Modifier</Button>
        <Button size="sm" variant="ghost" onClick={remove}>Supprimer</Button>
      </span>
    </li>
  );
}
