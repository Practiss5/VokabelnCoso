import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { hasCloze, orderQueue, type Word } from "@/lib/vocab";
import { ReviewSession } from "@/components/ReviewSession";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

type Mode = "flashcard" | "choice" | "speaking" | "typing" | "context";
const SKILL_OF_MODE = { flashcard: "recognition", choice: "translation", speaking: "speaking", typing: "writing", context: "context" } as const;

export const Route = createFileRoute("/_authenticated/eleve/reviser/$listId")({
  head: () => ({ meta: [{ title: "Réviser — Vocabulaire Allemand" }, { name: "description", content: "Séance de révision." }, { property: "og:title", content: "Réviser — Vocabulaire Allemand" }, { property: "og:description", content: "Séance de révision." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => (
    <AppShell>
      <Review />
    </AppShell>
  ),
});

const MODES: { id: Mode; title: string; desc: string }[] = [
  { id: "flashcard", title: "Cartes", desc: "Le mot allemand s'affiche : le connaissez-vous ?" },
  { id: "choice", title: "QCM", desc: "Choisissez la bonne traduction parmi quatre." },
  { id: "speaking", title: "Prononciation 🎙️", desc: "Le mot français s'affiche : dites-le en allemand, avec l'article." },
  { id: "typing", title: "Écriture", desc: "Écrivez le mot allemand à partir du français." },
  { id: "context", title: "Phrases à trou", desc: "Complétez une phrase allemande avec le bon mot." },
];

function Review() {
  const { listId } = Route.useParams();
  const { data: me } = useSuspenseQuery(meQuery);
  const [mode, setMode] = useState<Mode | null>(null);
  const [session, setSession] = useState<{ words: Word[]; pool: Word[]; caughtUp: boolean } | null>(null);
  const [title, setTitle] = useState("");

  async function start(m: Mode) {
    const [list, words, prog] = await Promise.all([
      supabase.from("vocab_lists").select("title").eq("id", listId).single(),
      supabase.from("words").select("id, german, french, example_de, example_fr").eq("list_id", listId),
      // Each mode schedules its own skill: a QCM success does not delay the writing review.
      supabase.from("skill_progress").select("word_id, due_at, step, wrong_count, correct_count")
        .eq("student_id", me!.id).eq("skill", SKILL_OF_MODE[m]),
    ]);
    if (list.error || !words.data?.length) { toast.error("Liste introuvable ou vide"); return; }
    const usable = m === "context" ? words.data.filter(hasCloze) : words.data;
    if (!usable.length) { toast.error("Cette liste n'a pas encore de phrases d'exemple."); return; }
    const progress = (prog.data ?? []).map((p) => ({ ...p, repetitions: p.step }));
    const { queue, caughtUp } = orderQueue(usable, progress, new Date());
    setTitle(list.data.title);
    setSession({ words: queue, pool: words.data, caughtUp });
    setMode(m);
  }

  if (!mode || !session)
    return (
      <div className="space-y-6">
        <Link to="/eleve" className="text-sm underline">← Mes listes</Link>
        <h1 className="text-4xl font-bold">Choisir un mode</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => start(m.id)} className="word-card p-5 text-left transition-transform hover:-translate-y-0.5">
              <h2 className="text-2xl font-bold">{m.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <ReviewSession key={mode} title={title} pool={session.pool} onQuit={() => setMode(null)}
      items={session.words.map((word) => ({ word, mode }))}
      notice={session.caughtUp ? "Tout est à jour ! Entraînement libre sur les mots les plus proches de leur révision." : undefined}
      endActions={<Button onClick={() => setMode(null)}>Choisir un autre mode</Button>} />
  );
}

