import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TeacherOnly } from "@/components/TeacherOnly";
import { Button } from "@/components/ui/button";
import { fetchAllReviews } from "@/lib/fetch-all";
import { formatDuration } from "@/lib/study-time";
import { studentReport, type ReportHw } from "@/lib/report";

export const Route = createFileRoute("/_authenticated/enseignant/bilan/$classId")({
  validateSearch: (s: Record<string, unknown>): { eleve?: string } => (typeof s.eleve === "string" ? { eleve: s.eleve } : {}),
  head: () => ({ meta: [{ title: "Fiche bilan — Vocabulaire Allemand" }, { name: "description", content: "Fiche bilan imprimable pour les parents." }, { property: "og:title", content: "Fiche bilan — Vocabulaire Allemand" }, { property: "og:description", content: "Fiche bilan imprimable pour les parents." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <TeacherOnly><Bilan /></TeacherOnly>,
});

function Bilan() {
  const { classId } = Route.useParams();
  const { eleve } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useQuery({
    queryKey: ["bilan", classId],
    queryFn: async () => {
      const cls = await supabase.from("classes").select("name").eq("id", classId).single();
      const students = (await supabase.from("profiles").select("id, full_name").eq("class_id", classId).order("full_name")).data ?? [];
      const ids = students.map((s) => s.id);
      const [hw, codes] = await Promise.all([
        supabase.from("homeworks").select("id, list_id, due_at, created_at, word_ids, requirements, vocab_lists(title, words(id))").eq("class_id", classId).order("due_at"),
        supabase.from("student_codes").select("student_id, label").eq("class_id", classId),
      ]);
      const hws = (hw.data ?? []) as unknown as (ReportHw & { vocab_lists: { title: string; words: { id: string }[] } | null })[];
      const reviews = ids.length ? await fetchAllReviews((f, t) => supabase.from("reviews").select("student_id, word_id, created_at, mode, correct").in("student_id", ids).order("created_at").order("id").range(f, t)) : [];
      const times = hws.length ? (await supabase.from("homework_time").select("homework_id, student_id, seconds").in("homework_id", hws.map((h) => h.id))).data ?? [] : [];
      const listWords = new Map(hws.map((h) => [h.list_id, (h.vocab_lists?.words ?? []).map((w) => w.id)]));
      const label = new Map((codes.data ?? []).filter((c) => c.student_id).map((c) => [c.student_id as string, c.label]));
      const rows = students.map((s) => ({
        id: s.id,
        name: label.get(s.id) || s.full_name || "Élève",
        r: studentReport(hws, listWords, reviews.filter((x) => x.student_id === s.id), new Map(times.filter((t) => t.student_id === s.id).map((t) => [t.homework_id, t.seconds]))),
      }));
      return { className: cls.data?.name ?? "", rows, titles: new Map(hws.map((h) => [h.id, h.vocab_lists?.title ?? "Liste"])) };
    },
  });
  if (!data) return <p className="p-6">Chargement…</p>;
  const shown = eleve ? data.rows.filter((r) => r.id === eleve) : data.rows;
  const today = new Date().toLocaleDateString("fr-FR");

  return (
    <div className="mx-auto max-w-[210mm] space-y-6 bg-background p-6 print:max-w-none print:p-0">
      <div className="space-y-3 print:hidden">
        <Link to="/enseignant/classes/$classId" params={{ classId }} className="text-sm underline">← Retour à la classe</Link>
        <h1 className="text-3xl font-bold">Fiches bilan — {data.className}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded-md border bg-background px-3 py-2 text-sm" value={eleve ?? ""} onChange={(e) => navigate({ search: e.target.value ? { eleve: e.target.value } : {} })}>
            <option value="">Toute la classe ({data.rows.length} fiches)</option>
            {data.rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <Button onClick={() => window.print()}>🖨️ Imprimer / Télécharger en PDF</Button>
        </div>
        <p className="text-xs text-muted-foreground">Pour obtenir un PDF, choisissez « Enregistrer au format PDF » comme imprimante. Une fiche par page.</p>
      </div>

      {shown.map((s) => (
        <article key={s.id} className="report-sheet space-y-5 rounded-lg border p-6 text-foreground print:rounded-none print:border-0 print:p-0">
          <header className="flex items-start justify-between gap-4 border-b pb-3">
            <div>
              <h2 className="text-2xl font-bold">Fiche bilan — Vocabulaire allemand</h2>
              <p className="text-lg">{s.name} · Classe {data.className}</p>
            </div>
            <p className="text-sm">{today}</p>
          </header>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Temps total d'apprentissage" value={formatDuration(s.r.totalSeconds)} />
            <Stat label="Taux de réussite moyen" value={s.r.rate === null ? "—" : `${s.r.rate} %`} sub={`${s.r.answers} réponses`} />
            <Stat label="Devoirs faits" value={`${s.r.done} / ${s.r.count}`} />
            <Stat label="Temps moyen par devoir" value={formatDuration(s.r.avgSeconds)} />
          </div>
          <table className="w-full border-collapse text-sm">
            <thead><tr className="text-left"><th className="border p-2">Devoir</th><th className="border p-2">Échéance</th><th className="border p-2">Temps</th><th className="border p-2">Statut</th></tr></thead>
            <tbody>
              {s.r.rows.map((h) => (
                <tr key={h.id}>
                  <td className="border p-2">{data.titles.get(h.id)}</td>
                  <td className="border p-2">{new Date(h.due_at).toLocaleDateString("fr-FR")}</td>
                  <td className="border p-2">{formatDuration(h.seconds)}</td>
                  <td className="border p-2 font-semibold">{h.done ? "✓ Fait" : h.overdue ? "✗ Non fait" : "En cours"}</td>
                </tr>
              ))}
              {s.r.rows.length === 0 && <tr><td colSpan={4} className="border p-2 text-muted-foreground">Aucun devoir pour le moment.</td></tr>}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">Le temps compte uniquement l'apprentissage actif (pause automatique après 60 s d'inactivité). Un devoir est « fait » quand les objectifs sont atteints avant l'échéance.</p>
          <p className="pt-6 text-sm">Signature des parents : ______________________</p>
        </article>
      ))}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
