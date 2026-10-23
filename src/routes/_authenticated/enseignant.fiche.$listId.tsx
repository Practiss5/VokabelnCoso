import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TeacherOnly } from "@/components/TeacherOnly";
import { Button } from "@/components/ui/button";
import { pickQuizWords } from "@/lib/vocab";

export const Route = createFileRoute("/_authenticated/enseignant/fiche/$listId")({
  head: () => ({ meta: [{ title: "Fiche de contrôle — Vocabulaire Allemand" }, { name: "description", content: "Interrogation de vocabulaire imprimable avec corrigé." }, { property: "og:title", content: "Fiche de contrôle — Vocabulaire Allemand" }, { property: "og:description", content: "Interrogation de vocabulaire imprimable avec corrigé." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <TeacherOnly><Sheet /></TeacherOnly>,
});

function Sheet() {
  const { listId } = Route.useParams();
  const [count, setCount] = useState(12);
  const [seed, setSeed] = useState(() => Math.random());
  const [key, setKey] = useState(false);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const { data } = useQuery({
    queryKey: ["fiche", listId],
    queryFn: async () => {
      const [l, w] = await Promise.all([
        supabase.from("vocab_lists").select("title").eq("id", listId).single(),
        supabase.from("words").select("id, german, french").eq("list_id", listId),
      ]);
      return { title: l.data?.title ?? "", words: w.data ?? [] };
    },
  });
  if (!data) return <p className="p-6">Chargement…</p>;
  const ids = chosen ?? pickQuizWords(data.words, count, seed).map((w) => w.id);
  const picked = ids.map((id) => data.words.find((w) => w.id === id)).filter((w): w is (typeof data.words)[number] => !!w);
  const half = Math.ceil(picked.length / 2);
  const fr = picked.slice(0, half), de = picked.slice(half);
  const cell = "border border-foreground/60 p-2";
  const toggle = (id: string) => setChosen(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  async function downloadWord() {
    if (!data || !picked.length) return;
    const { quizDocx } = await import("@/lib/quiz-docx");
    const blob = await quizDocx(data.title, picked);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `interro-${data.title.replace(/[^\p{L}\p{N}]+/gu, "-")}.docx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  return (
    <div className="mx-auto max-w-[210mm] space-y-6 bg-background p-6 print:p-0">
      <div className="space-y-3 print:hidden">
        <Link to="/enseignant/listes/$listId" params={{ listId }} className="text-sm underline">← Retour à la liste</Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Tirage au hasard :</span>
          {[10, 12].map((n) => <Button key={n} size="sm" variant="outline" onClick={() => { setCount(n); setSeed(Math.random()); setChosen(null); }}>🔀 {n} mots</Button>)}
          <Button size="sm" variant={key ? "default" : "outline"} onClick={() => setKey((k) => !k)}>{key ? "Masquer le corrigé" : "Afficher le corrigé"}</Button>
          <Button size="sm" onClick={() => window.print()}>🖨️ Imprimer</Button>
          <Button size="sm" onClick={downloadWord} disabled={!picked.length}>📄 Télécharger en Word</Button>
        </div>
        <details className="rounded-lg border p-3" open>
          <summary className="cursor-pointer text-sm font-semibold">Choisir les mots moi-même ({picked.length} cochés)</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => setChosen(data.words.map((w) => w.id))}>Tout cocher</Button>
            <Button size="sm" variant="ghost" onClick={() => setChosen([])}>Tout décocher</Button>
          </div>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {data.words.map((w) => (
              <label key={w.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ids.includes(w.id)} onChange={() => toggle(w.id)} className="h-4 w-4" />
                <span><b>{w.german}</b> — {w.french}</span>
              </label>
            ))}
          </div>
        </details>
        <p className="text-xs text-muted-foreground">Le fichier Word contient la version élève puis le corrigé, et vous pouvez le modifier librement.</p>
      </div>

      <article className="space-y-5 text-foreground">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Interrogation de vocabulaire{key ? " — CORRIGÉ" : ""}</h1>
            <p className="text-lg">{data.title}</p>
          </div>
          <p className="text-lg font-bold">Note : ____ / {picked.length}</p>
        </header>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <p>Nom : ______________</p><p>Prénom : ____________</p><p>Date : ___________</p>
        </div>
        <section>
          <h2 className="mb-2 font-bold">1. Traduis en allemand (avec l'article pour les noms).</h2>
          <table className="w-full border-collapse text-sm">
            <tbody>{fr.map((w, i) => (
              <tr key={w.id}><td className={`${cell} w-8`}>{i + 1}</td><td className={`${cell} w-1/2`}>{w.french}</td><td className={`${cell} h-10 font-bold`}>{key ? w.german : ""}</td></tr>
            ))}</tbody>
          </table>
        </section>
        <section>
          <h2 className="mb-2 font-bold">2. Traduis en français.</h2>
          <table className="w-full border-collapse text-sm">
            <tbody>{de.map((w, i) => (
              <tr key={w.id}><td className={`${cell} w-8`}>{half + i + 1}</td><td className={`${cell} w-1/2`}>{w.german}</td><td className={`${cell} h-10 font-bold`}>{key ? w.french : ""}</td></tr>
            ))}</tbody>
          </table>
        </section>
      </article>
    </div>
  );
}
