import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { homeworkStatus } from "@/lib/vocab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fmt = (d: string) => new Date(d).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

type Hw = { id: string; list_id: string; due_at: string; instructions: string; created_at: string; vocab_lists: { title: string; words: { id: string }[] } | null };
const HW_SELECT = "id, list_id, due_at, instructions, created_at, vocab_lists(title, words(id))";

/** Teacher: give homework to a class and see who did it. */
export function TeacherHomework({ classId, students }: { classId: string; students: { id: string; full_name: string }[] }) {
  const qc = useQueryClient();
  const [listId, setListId] = useState("");
  const [due, setDue] = useState("");
  const [text, setText] = useState("");
  const { data } = useQuery({
    queryKey: ["homeworks", classId],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const [hw, lists] = await Promise.all([
        supabase.from("homeworks").select(HW_SELECT).eq("class_id", classId).order("due_at", { ascending: false }),
        supabase.from("vocab_lists").select("id, title").eq("teacher_id", u.user!.id).order("title"),
      ]);
      const ids = students.map((s) => s.id);
      const rev = ids.length ? (await supabase.from("reviews").select("student_id, word_id, created_at").in("student_id", ids)).data ?? [] : [];
      return { hw: (hw.data ?? []) as Hw[], lists: lists.data ?? [], rev };
    },
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    // Make sure the class can open the list.
    await supabase.from("list_assignments").upsert({ list_id: listId, class_id: classId }, { onConflict: "list_id,class_id", ignoreDuplicates: true });
    const { error } = await supabase.from("homeworks").insert({ teacher_id: u.user!.id, class_id: classId, list_id: listId, due_at: new Date(due).toISOString(), instructions: text.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success("Devoir donné à la classe");
    setText(""); setDue(""); setListId("");
    qc.invalidateQueries({ queryKey: ["homeworks", classId] });
    qc.invalidateQueries({ queryKey: ["class", classId] });
  }
  async function remove(id: string) {
    if (!confirm("Supprimer ce devoir ?")) return;
    await supabase.from("homeworks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["homeworks", classId] });
  }

  return (
    <section className="word-card space-y-4 p-4">
      <h2 className="text-xl font-bold">📅 Devoirs</h2>
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Liste à réviser
            <select required value={listId} onChange={(e) => setListId(e.target.value)} className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3">
              <option value="">Choisir…</option>
              {data?.lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </label>
          <label className="text-sm">À faire pour le
            <Input required type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1" />
          </label>
          <label className="text-sm sm:col-span-2">Consigne (facultatif)
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. : réviser en mode Écriture" className="mt-1" />
          </label>
        </div>
        <Button type="submit">Donner en devoir</Button>
      </form>
      <p className="text-xs text-muted-foreground">Un devoir est « fait » quand l'élève a répondu au moins une fois à chaque mot de la liste avant la date limite.</p>
      {data?.hw.map((h) => {
        const words = h.vocab_lists?.words.map((w) => w.id) ?? [];
        const st = students.map((s) => ({ s, r: homeworkStatus(words, data.rev.filter((x) => x.student_id === s.id), h.created_at, h.due_at) }));
        const doneN = st.filter((x) => x.r.done).length;
        const late = new Date(h.due_at).getTime() < Date.now();
        return (
          <div key={h.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold">{h.vocab_lists?.title}</p>
                <p className="text-sm text-muted-foreground">Pour {fmt(h.due_at)}{late ? " · terminé" : ""}{h.instructions ? ` · ${h.instructions}` : ""}</p>
                <p className="text-sm font-semibold">{doneN}/{students.length} élèves ont fait le devoir</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(h.id)}>Supprimer</Button>
            </div>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {st.map(({ s, r }) => (
                <li key={s.id} className="flex justify-between gap-2 rounded bg-secondary px-2 py-1">
                  <span>{s.full_name || "—"}</span>
                  <span className={r.done ? "font-semibold text-success" : "text-muted-foreground"}>{r.done ? "Fait ✅" : `${late ? "Non fait" : "À faire"} ⏳ ${r.answered}/${r.total}`}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {data && data.hw.length === 0 && <p className="text-sm text-muted-foreground">Aucun devoir pour l'instant.</p>}
    </section>
  );
}

/** Student: upcoming homework shown at the top of the home page. */
export function StudentHomework({ studentId, classId }: { studentId: string; classId: string }) {
  const { data } = useQuery({
    queryKey: ["my-homeworks", classId],
    queryFn: async () => {
      const since = new Date(Date.now() - 2 * 86400000).toISOString();
      const hw = ((await supabase.from("homeworks").select(HW_SELECT).eq("class_id", classId).gte("due_at", since).order("due_at")).data ?? []) as Hw[];
      const rev = hw.length ? (await supabase.from("reviews").select("word_id, created_at").eq("student_id", studentId)).data ?? [] : [];
      return hw.map((h) => ({ h, r: homeworkStatus(h.vocab_lists?.words.map((w) => w.id) ?? [], rev, h.created_at, h.due_at) }));
    },
  });
  if (!data?.length) return null;
  return (
    <section className="space-y-3">
      {data.map(({ h, r }) => {
        const late = new Date(h.due_at).getTime() < Date.now();
        return (
          <div key={h.id} className={`word-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between ${r.done ? "border-success" : "border-accent"} border-2`}>
            <div>
              <p className="text-sm font-semibold">{r.done ? "✅ Devoir validé, bravo !" : late ? "⌛ Devoir en retard" : `📌 Devoir à faire pour ${fmt(h.due_at)}`}</p>
              <p className="text-xl font-bold">{h.vocab_lists?.title}</p>
              {h.instructions && <p className="text-sm">{h.instructions}</p>}
              {!r.done && <p className="text-sm text-muted-foreground">{r.answered}/{r.total} mots déjà révisés</p>}
            </div>
            {!r.done && <Button asChild size="lg"><Link to="/eleve/reviser/$listId" params={{ listId: h.list_id }}>Commencer le devoir</Link></Button>}
          </div>
        );
      })}
    </section>
  );
}
