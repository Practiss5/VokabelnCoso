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

type L = { id: string; title: string; folder_id: string | null; words: unknown };
function Lists() {
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [folderName, setFolderName] = useState("");
  const [shareCode, setShareCode] = useState("");
  const { data } = useQuery({
    queryKey: ["lists"],
    queryFn: async () => {
      const [lists, folders, classes] = await Promise.all([
        supabase.from("vocab_lists").select("id, title, folder_id, words(count)").eq("teacher_id", me!.id).order("created_at"),
        supabase.from("list_folders").select("id, name, share_code").eq("teacher_id", me!.id).order("name"),
        supabase.from("classes").select("id, name").eq("teacher_id", me!.id).order("name"),
      ]);
      if (lists.error) throw lists.error;
      return { lists: lists.data as L[], folders: folders.data ?? [], classes: classes.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["lists"] });
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("vocab_lists").insert({ title: title.trim(), teacher_id: me!.id });
    if (error) { toast.error(error.message); return; }
    setTitle(""); refresh();
  }
  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("list_folders").insert({ name: folderName.trim(), teacher_id: me!.id });
    if (error) { toast.error(error.message); return; }
    setFolderName(""); refresh();
  }
  async function importFolder(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("copy_folder", { _code: shareCode });
    if (error) { toast.error(error.message); return; }
    toast.success("Classeur copié dans vos listes"); setShareCode(""); refresh();
  }
  async function move(listId: string, folderId: string) {
    const { error } = await supabase.from("vocab_lists").update({ folder_id: folderId || null }).eq("id", listId);
    if (error) toast.error(error.message); else refresh();
  }
  async function removeFolder(id: string) {
    if (!confirm("Supprimer ce classeur ? Les listes ne sont pas supprimées, elles vont dans « Autres listes ».")) return;
    await supabase.from("list_folders").delete().eq("id", id); refresh();
  }
  async function assignFolder(folderId: string, classId: string) {
    const ids = data!.lists.filter((l) => l.folder_id === folderId).map((l) => l.id);
    if (!classId || !ids.length) return;
    const { error } = await supabase.from("list_assignments").upsert(ids.map((list_id) => ({ list_id, class_id: classId })), { onConflict: "list_id,class_id", ignoreDuplicates: true });
    if (error) toast.error(error.message); else toast.success(`${ids.length} listes attribuées à la classe`);
  }
  const row = (l: L) => (
    <li key={l.id} className="flex items-center justify-between gap-2 py-2">
      <Link to="/enseignant/listes/$listId" params={{ listId: l.id }} className="min-w-0 flex-1 py-1 hover:underline">
        <span className="font-medium">{l.title}</span>{" "}
        <span className="text-sm text-muted-foreground">· {(l.words as { count: number }[])[0]?.count ?? 0} mots</span>
      </Link>
      <select aria-label={`Classeur de ${l.title}`} value={l.folder_id ?? ""} onChange={(e) => move(l.id, e.target.value)} className="h-9 max-w-36 rounded-md border border-input bg-background px-2 text-sm">
        <option value="">Sans classeur</option>
        {data!.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </li>
  );
  const loose = data?.lists.filter((l) => !l.folder_id || !data.folders.some((f) => f.id === l.folder_id)) ?? [];
  return (
    <section className="word-card p-5">
      <h2 className="text-2xl font-bold">Mes listes</h2>
      <form onSubmit={create} className="mt-4 flex gap-2">
        <Input required placeholder="Titre (ex. La maison)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button type="submit">Créer</Button>
      </form>
      <form onSubmit={createFolder} className="mt-2 flex gap-2">
        <Input required placeholder="Nouveau classeur (ex. Kapitel 1)" value={folderName} onChange={(e) => setFolderName(e.target.value)} />
        <Button type="submit" variant="secondary">📁 Créer</Button>
      </form>
      <form onSubmit={importFolder} className="mt-2 flex gap-2">
        <Input required placeholder="Code d'un collègue (ex. A1B2C3D4)" value={shareCode} onChange={(e) => setShareCode(e.target.value)} className="font-mono uppercase" />
        <Button type="submit" variant="secondary">Copier</Button>
      </form>
      <div className="mt-4 space-y-3">
        {data?.folders.map((f) => {
          const inside = data.lists.filter((l) => l.folder_id === f.id);
          return (
            <details key={f.id} open className="rounded-lg border p-3">
              <summary className="cursor-pointer text-lg font-bold">📁 {f.name} <span className="text-sm font-normal text-muted-foreground">({inside.length} listes)</span></summary>
              <ul className="mt-2 divide-y">{inside.map(row)}</ul>
              {inside.length === 0 && <p className="text-sm text-muted-foreground">Classeur vide : rangez-y une liste avec le menu à droite.</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {inside.length > 0 && data.classes.length > 0 && (
                  <select aria-label={`Attribuer le classeur ${f.name}`} value="" onChange={(e) => assignFolder(f.id, e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">Attribuer tout le classeur à…</option>
                    {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                <span className="text-sm text-muted-foreground">Code de partage : <b className="font-mono text-foreground">{f.share_code}</b></span>
                <Button size="sm" variant="ghost" onClick={() => removeFolder(f.id)}>Supprimer le classeur</Button>
              </div>
            </details>
          );
        })}
        {data && (data.folders.length > 0 ? loose.length > 0 : true) && (
          <div>
            {data.folders.length > 0 && <h3 className="font-bold">Autres listes</h3>}
            <ul className="divide-y">{loose.map(row)}</ul>
          </div>
        )}
        {data?.lists.length === 0 && <p className="text-sm text-muted-foreground">Aucune liste pour l'instant.</p>}
      </div>
    </section>
  );
}
