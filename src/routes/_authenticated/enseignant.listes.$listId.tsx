import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateExamples } from "@/lib/examples.functions";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { TeacherOnly } from "@/components/TeacherOnly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { GermanAudio } from "@/components/GermanAudio";
import { parseImport, type ImportRow } from "@/lib/import";

export const Route = createFileRoute("/_authenticated/enseignant/listes/$listId")({
  head: () => ({ meta: [{ title: "Liste de vocabulaire — Vocabulaire Allemand" }, { name: "description", content: "Modifier une liste de vocabulaire." }, { property: "og:title", content: "Liste de vocabulaire — Vocabulaire Allemand" }, { property: "og:description", content: "Modifier une liste de vocabulaire." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
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
        supabase.from("vocab_lists").select("id, title, level").eq("id", listId).single(),
        supabase.from("words").select("id, german, french, example_de, example_fr").eq("list_id", listId).order("created_at"),
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
  const [preview, setPreview] = useState<ImportRow[] | null>(null);
  async function addBulk() {
    const rows = (preview ?? []).filter((r) => r.german.trim() && r.french.trim())
      .map((r) => ({ list_id: listId, german: r.german.trim(), french: r.french.trim() }));
    if (!rows.length) { toast.error("Aucune ligne valide"); return; }
    const { error } = await supabase.from("words").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} mots ajoutés`);
    setBulk(""); setPreview(null); refresh();
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

  const gen = useServerFn(generateExamples);
  const [genBusy, setGenBusy] = useState(false);
  async function generateAll() {
    setGenBusy(true);
    try {
      const r = await gen({ data: { listId } });
      toast.success(r.updated ? `${r.updated} phrases proposées — relisez-les ci-dessous` : "Tous les mots ont déjà une phrase");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setGenBusy(false); }
  }
  async function setLevel(level: string) {
    const { error } = await supabase.from("vocab_lists").update({ level }).eq("id", listId);
    if (error) toast.error(error.message); else refresh();
  }

  if (!data) return <p>Chargement…</p>;
  const missing = data.words.filter((w) => !w.example_de.trim()).length;

  return (
    <div className="space-y-8">
      <Link to="/enseignant" className="text-sm underline">← Retour</Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input defaultValue={data.list.title} onBlur={(e) => rename(e.target.value)} className="h-auto border-0 bg-transparent px-0 font-display text-4xl font-bold shadow-none" />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/enseignant/fiche/$listId" params={{ listId: data.list.id }}>🖨️ Fiche de contrôle</Link></Button>
          <Button variant="destructive" onClick={deleteList}>Supprimer la liste</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Niveau :</span>
        {["A1", "A2", "B1"].map((l) => (
          <Button key={l} size="sm" variant={data.list.level === l ? "default" : "outline"} onClick={() => setLevel(l)}>{l}</Button>
        ))}
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
        <div className="mt-4 flex flex-col gap-2 rounded-lg bg-secondary p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>Phrases d'exemple : {data.words.length - missing}/{data.words.length}. Écrivez le mot à trouver entre crochets : <code>Ich habe einen [Hund].</code></span>
          <Button size="sm" disabled={genBusy || missing === 0} onClick={generateAll}>{genBusy ? "Génération…" : `✨ Proposer les phrases (${data.list.level})`}</Button>
        </div>
        <ul className="mt-4 divide-y">
          {data.words.map((w) => <WordRow key={w.id} word={w} listId={listId} onChange={refresh} />)}
        </ul>
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium">📥 Import rapide (Quizlet, Excel, Word)</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Colle un mot par ligne. Séparateurs reconnus : tabulation (export Quizlet / Excel), <code>=</code>, <code>;</code>, <code> - </code> ou virgule.
            L'ordre allemand / français est détecté tout seul. Ex. : <code>der Hund = le chien</code>
          </p>
          <Textarea rows={6} value={bulk} onChange={(e) => { setBulk(e.target.value); setPreview(null); }} className="mt-2" placeholder={"der Hund\tle chien\ndas Haus, ¨-er = la maison"} />
          <Button className="mt-2" variant="secondary" disabled={!bulk.trim()} onClick={() => setPreview(parseImport(bulk))}>Aperçu</Button>
          {preview && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground"><span>Allemand</span><span>Français</span><span /></div>
              {preview.map((r, i) => {
                const upd = (p: Partial<ImportRow>) => setPreview(preview.map((x, j) => (j === i ? { ...x, ...p } : x)));
                const bad = !r.german.trim() || !r.french.trim();
                return (
                  <div key={i} className={`grid grid-cols-[1fr_1fr_auto] gap-2 ${bad ? "rounded border border-destructive p-1" : ""}`}>
                    <Input value={r.german} onChange={(e) => upd({ german: e.target.value })} />
                    <Input value={r.french} onChange={(e) => upd({ french: e.target.value })} />
                    <Button size="sm" variant="ghost" onClick={() => setPreview(preview.filter((_, j) => j !== i))}>✕</Button>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2">
                <Button onClick={addBulk}>Ajouter ces {preview.filter((r) => r.german.trim() && r.french.trim()).length} mots</Button>
                <Button variant="outline" onClick={() => setPreview(preview.map((r) => ({ ...r, german: r.french, french: r.german })))}>⇄ Inverser les colonnes</Button>
              </div>
              {preview.some((r) => !r.german.trim() || !r.french.trim()) && <p className="text-xs text-destructive">Les lignes encadrées en rouge sont incomplètes et ne seront pas ajoutées.</p>}
            </div>
          )}
        </details>
      </section>
    </div>
  );
}

type W = { id: string; german: string; french: string; example_de: string; example_fr: string };
function WordRow({ word, listId, onChange }: { word: W; listId: string; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [de, setDe] = useState(word.german);
  const [fr, setFr] = useState(word.french);
  const [exDe, setExDe] = useState(word.example_de);
  const [exFr, setExFr] = useState(word.example_fr);
  const [busy, setBusy] = useState(false);
  const gen = useServerFn(generateExamples);
  async function propose() {
    setBusy(true);
    try { await gen({ data: { listId, wordId: word.id } }); toast.success("Phrase proposée"); onChange(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  }
  async function save() {
    if (exDe.trim() && !/\[[^\]]+\]/.test(exDe)) { toast.error("Mettez le mot à trouver entre crochets [ ]"); return; }
    const { error } = await supabase.from("words").update({ german: de.trim(), french: fr.trim(), example_de: exDe.trim(), example_fr: exFr.trim() }).eq("id", word.id);
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
      <li className="grid gap-2 py-2 sm:grid-cols-2">
        <Input value={de} onChange={(e) => setDe(e.target.value)} />
        <Input value={fr} onChange={(e) => setFr(e.target.value)} />
        <Input value={exDe} onChange={(e) => setExDe(e.target.value)} placeholder="Phrase : Ich habe einen [Hund]." />
        <Input value={exFr} onChange={(e) => setExFr(e.target.value)} placeholder="Traduction : J'ai un chien." />
        <div className="flex gap-2 sm:col-span-2">
          <Button size="sm" onClick={save}>OK</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</Button>
        </div>
      </li>
    );
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex items-center gap-2">
          <span className="min-w-0 break-words"><b>{word.german}</b> <span className="text-muted-foreground">— {word.french}</span></span>
          <GermanAudio text={word.german} />
        </div>
        {word.example_de && <div className="mt-1 flex items-center gap-2">
          <span className="min-w-0 break-words text-sm italic">{word.example_de} <span className="not-italic text-muted-foreground">{word.example_fr}</span></span>
          <GermanAudio text={word.example_de} label="Écouter la phrase" />
        </div>}
      </div>
      <span className="flex shrink-0 flex-wrap justify-end gap-1">
        <Button size="sm" variant="ghost" disabled={busy} onClick={propose}>{busy ? "…" : "✨ Phrase"}</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Modifier</Button>
        <Button size="sm" variant="ghost" onClick={remove}>Supprimer</Button>
      </span>
    </li>
  );
}
