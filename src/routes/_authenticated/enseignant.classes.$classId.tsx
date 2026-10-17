import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TeacherOnly } from "./enseignant.index";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/enseignant/classes/$classId")({
  head: () => ({ meta: [{ title: "Classe — Vocabulaire Allemand" }, { name: "description", content: "Progrès des élèves de la classe." }] }),
  component: () => (
    <AppShell>
      <TeacherOnly>
        <ClassPage />
      </TeacherOnly>
    </AppShell>
  ),
});

function ClassPage() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      const cls = await supabase.from("classes").select("id, name, join_code").eq("id", classId).single();
      if (cls.error) throw cls.error;
      const students = (await supabase.from("profiles").select("id, full_name").eq("class_id", classId).order("full_name")).data ?? [];
      const ids = students.map((s) => s.id);
      const [reviews, progress, lists] = await Promise.all([
        ids.length ? supabase.from("reviews").select("student_id, correct, created_at").in("student_id", ids) : Promise.resolve({ data: [] }),
        ids.length ? supabase.from("word_progress").select("student_id, repetitions").in("student_id", ids) : Promise.resolve({ data: [] }),
        supabase.from("list_assignments").select("vocab_lists(id, title)").eq("class_id", classId),
      ]);
      const rows = students.map((s) => {
        const r = (reviews.data ?? []).filter((x) => x.student_id === s.id);
        const p = (progress.data ?? []).filter((x) => x.student_id === s.id);
        const correct = r.filter((x) => x.correct).length;
        const last = r.reduce<string | null>((m, x) => (!m || x.created_at > m ? x.created_at : m), null);
        return { ...s, total: r.length, rate: r.length ? Math.round((correct / r.length) * 100) : null, mastered: p.filter((x) => x.repetitions >= 3).length, seen: p.length, last };
      });
      return { cls: cls.data, rows, lists: (lists.data ?? []).map((l) => l.vocab_lists).filter(Boolean) as { id: string; title: string }[] };
    },
  });

  async function remove() {
    if (!confirm("Supprimer cette classe ? Les élèves ne seront plus rattachés.")) return;
    const { error } = await supabase.from("classes").delete().eq("id", classId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["classes"] });
    navigate({ to: "/enseignant" });
  }

  if (!data) return <p>Chargement…</p>;
  return (
    <div className="space-y-6">
      <Link to="/enseignant" className="text-sm underline">← Retour</Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold">{data.cls.name}</h1>
          <p className="mt-2">Code à donner aux élèves : <span className="rounded bg-accent px-2 py-1 font-mono text-lg font-bold">{data.cls.join_code}</span></p>
        </div>
        <Button variant="destructive" onClick={remove}>Supprimer la classe</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Listes attribuées : {data.lists.length ? data.lists.map((l) => l.title).join(", ") : "aucune"}
      </p>
      <section className="word-card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-3">Élève</th><th className="p-3">Réponses</th><th className="p-3">Réussite</th><th className="p-3">Mots vus</th><th className="p-3">Maîtrisés</th><th className="p-3">Dernière révision</th></tr>
          </thead>
          <tbody className="divide-y">
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3 font-medium">{r.full_name || "—"}</td>
                <td className="p-3">{r.total}</td>
                <td className="p-3">{r.rate === null ? "—" : `${r.rate} %`}</td>
                <td className="p-3">{r.seen}</td>
                <td className="p-3">{r.mastered}</td>
                <td className="p-3">{r.last ? new Date(r.last).toLocaleString("fr-FR") : "—"}</td>
              </tr>
            ))}
            {data.rows.length === 0 && <tr><td colSpan={6} className="p-4 text-muted-foreground">Aucun élève. Donnez-leur le code de classe pour s'inscrire.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
