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
  const picked = pickQuizWords(data.words, count, seed);
  const half = Math.ceil(picked.length / 2);
  const fr = picked.slice(0, half), de = picked.slice(half);
  const cell = "border border-foreground/60 p-2";

  return (
    <div className="mx-auto max-w-[210mm] space-y-6 bg-background p-6 print:p-0">
      <div className="space-y-3 print:hidden">
        <Link to="/enseignant/listes/$listId" params={{ listId }} className="text-sm underline">← Retour à la liste</Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Nombre de mots :</span>
          {[10, 12].map((n) => <Button key={n} size="sm" variant={count === n ? "default" : "outline"} onClick={() => setCount(n)}>{n}</Button>)}
          <Button size="sm" variant="outline" onClick={() => setSeed(Math.random())}>🔀 Autres mots</Button>
          <Button size="sm" variant={key ? "default" : "outline"} onClick={() => setKey((k) => !k)}>{key ? "Corrigé affiché" : "Version élève"}</Button>
          <Button size="sm" onClick={() => window.print()}>🖨️ Imprimer</Button>
        </div>
        <p className="text-xs text-muted-foreground">Imprimez la version élève, puis touchez « Version élève » pour afficher et imprimer le corrigé avec les mêmes mots. Pour un PDF, choisissez « Enregistrer en PDF » dans la fenêtre d'impression.</p>
        {data.words.length < count && <p className="text-sm text-destructive">La liste ne contient que {data.words.length} mots.</p>}
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
