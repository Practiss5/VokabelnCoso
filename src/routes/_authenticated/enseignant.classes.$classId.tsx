import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TeacherOnly } from "@/components/TeacherOnly";
import { Button } from "@/components/ui/button";
import { ERROR_LABELS, isMastered } from "@/lib/vocab";
import { TeacherHomework } from "@/components/Homework";
import { StudentCodes } from "@/components/StudentCodes";
import { fetchAllReviews } from "@/lib/fetch-all";

export const Route = createFileRoute("/_authenticated/enseignant/classes/$classId")({
  head: () => ({ meta: [{ title: "Classe — Vocabulaire Allemand" }, { name: "description", content: "Progrès des élèves de la classe." }, { property: "og:title", content: "Classe — Vocabulaire Allemand" }, { property: "og:description", content: "Progrès des élèves de la classe." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
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
      const [reviews, progress, lists, codes] = await Promise.all([
        ids.length ? fetchAllReviews((from, to) => supabase.from("reviews").select("student_id, word_id, correct, created_at, error_type, words(german, french)").in("student_id", ids).order("created_at").order("id").range(from, to)).then((data) => ({ data })) : Promise.resolve({ data: [] }),
        ids.length ? fetchAllReviews((from, to) => supabase.from("skill_progress").select("student_id, word_id, skill, step").in("student_id", ids).order("student_id").order("word_id").order("skill").range(from, to)).then((data) => ({ data })) : Promise.resolve({ data: [] }),
        supabase.from("list_assignments").select("vocab_lists(id, title)").eq("class_id", classId),
        supabase.from("student_codes").select("student_id, label").eq("class_id", classId),
      ]);
      const labelByStudent = new Map((codes.data ?? []).filter((c) => c.student_id).map((c) => [c.student_id as string, c.label]));
      const rows = students.map((s) => {
        const r = (reviews.data ?? []).filter((x) => x.student_id === s.id);
        const p = (progress.data ?? []).filter((x) => x.student_id === s.id);
        const correct = r.filter((x) => x.correct).length;
        const last = r.reduce<string | null>((m, x) => (!m || x.created_at > m ? x.created_at : m), null);
        return { ...s, label: labelByStudent.get(s.id) ?? "", total: r.length, rate: r.length ? Math.round((correct / r.length) * 100) : null, mastered: [...new Set(p.map((x) => x.word_id))].filter((id) => isMastered(p.filter((x) => x.word_id === id))).length, seen: new Set(p.map((x) => x.word_id)).size, last };
      });
      // Hardest words for the class: most errors, then lowest success rate.
      const byWord = new Map<string, { german: string; french: string; ok: number; ko: number; students: Set<string>; errs: Record<string, number> }>();
      for (const r of reviews.data ?? []) {
        const w = (r as { words?: { german: string; french: string } | null }).words;
        if (!w) continue;
        const e = byWord.get(r.word_id) ?? { ...w, ok: 0, ko: 0, students: new Set<string>(), errs: {} };
        if (r.correct) e.ok++; else { e.ko++; e.students.add(r.student_id); if (r.error_type) e.errs[r.error_type] = (e.errs[r.error_type] ?? 0) + 1; }
        byWord.set(r.word_id, e);
      }
      const hard = [...byWord.values()].filter((w) => w.ko > 0)
        .sort((a, b) => b.ko - a.ko || a.ok / (a.ok + a.ko) - b.ok / (b.ok + b.ko)).slice(0, 10);
      return { cls: cls.data, rows, hard, lists: (lists.data ?? []).map((l) => l.vocab_lists).filter(Boolean) as { id: string; title: string }[] };
    },
  });

  async function remove() {
    if (!confirm("Supprimer cette classe ? Les élèves ne seront plus rattachés.")) return;
    const { error } = await supabase.from("classes").delete().eq("id", classId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["classes"] });
    navigate({ to: "/enseignant" });
  }

  async function purgeYear() {
    if (!confirm("Clôturer l'année ? Toute la progression des élèves de la classe sera effacée et leurs codes désactivés. Les listes, devoirs et la classe sont conservés.")) return;
    const { error } = await supabase.rpc("purge_class_data", { _class: classId });
    if (error) { toast.error(error.message); return; }
    toast.success("Année clôturée : progression effacée et codes désactivés.");
    qc.invalidateQueries({ queryKey: ["class", classId] });
    qc.invalidateQueries({ queryKey: ["student-codes", classId] });
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={purgeYear}>🧹 Clôturer l'année</Button>
          <Button variant="destructive" onClick={remove}>Supprimer la classe</Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Listes attribuées : {data.lists.length ? data.lists.map((l) => l.title).join(", ") : "aucune"}
      </p>
      <StudentCodes classId={classId} />
      <TeacherHomework classId={classId} students={data.rows.map((r) => ({ id: r.id, full_name: r.label || r.full_name }))} />
      <section className="word-card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-3">Élève</th><th className="p-3">Réponses</th><th className="p-3">Réussite</th><th className="p-3">Mots vus</th><th className="p-3">Maîtrisés</th><th className="p-3">Dernière révision</th></tr>
          </thead>
          <tbody className="divide-y">
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3 font-medium">{r.label || r.full_name || "—"}</td>
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
      <section className="word-card overflow-x-auto p-0">
        <h2 className="p-4 pb-0 text-xl font-bold">Mots les plus difficiles</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-3">Mot</th><th className="p-3">Erreurs</th><th className="p-3">Réussite</th><th className="p-3">Élèves en difficulté</th><th className="p-3">Erreur la plus fréquente</th></tr>
          </thead>
          <tbody className="divide-y">
            {data.hard.map((w) => {
              const top = Object.entries(w.errs).sort((a, b) => b[1] - a[1])[0];
              return (
                <tr key={w.german + w.french}>
                  <td className="p-3"><b>{w.german}</b> <span className="text-muted-foreground">— {w.french}</span></td>
                  <td className="p-3">{w.ko}</td>
                  <td className="p-3">{Math.round((w.ok / (w.ok + w.ko)) * 100)} %</td>
                  <td className="p-3">{w.students.size}</td>
                  <td className="p-3">{top ? ERROR_LABELS[top[0]] ?? top[0] : "—"}</td>
                </tr>
              );
            })}
            {data.hard.length === 0 && <tr><td colSpan={5} className="p-4 text-muted-foreground">Pas encore d'erreurs enregistrées.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
