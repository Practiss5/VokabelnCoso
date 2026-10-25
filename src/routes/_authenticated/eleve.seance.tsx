import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { meQuery } from "@/lib/session";
import { dailyQuery } from "@/lib/daily";
import { hasCloze, MODE_LABELS, orderQueue, type DailyMode } from "@/lib/vocab";
import { AppShell } from "@/components/AppShell";
import { ReviewSession, type SessionItem } from "@/components/ReviewSession";
import { Button } from "@/components/ui/button";

const MODES: DailyMode[] = ["flashcard", "choice", "speaking", "typing", "context", "dictation"];
const SKILL_OF_MODE = { flashcard: "recognition", choice: "translation", speaking: "speaking", typing: "writing", context: "context", dictation: "writing" } as const;

export const Route = createFileRoute("/_authenticated/eleve/seance")({
  validateSearch: (s: Record<string, unknown>): { mode?: DailyMode } =>
    MODES.includes(s['mode'] as DailyMode) ? { mode: s['mode'] as DailyMode } : {},
  head: () => ({ meta: [{ title: "Séance du jour — Vocabulaire Allemand" }, { name: "description", content: "Votre séance personnalisée de 5 à 10 minutes." }, { property: "og:title", content: "Séance du jour — Vocabulaire Allemand" }, { property: "og:description", content: "Votre séance personnalisée de 5 à 10 minutes." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => (
    <AppShell>
      <Daily />
    </AppShell>
  ),
});

function Daily() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useQuery({ ...dailyQuery(me!.id, me!.classId ?? ""), enabled: !!me?.classId, staleTime: Infinity });
  // Freeze the selection once loaded so it does not change mid-session.
  const frozen = useMemo<SessionItem[] | null>(() => {
    if (!data) return null;
    if (!mode) return data.items;
    // Chosen step: all class words in that mode, ordered by that skill's own schedule.
    const usable = mode === "context" ? data.words.filter(hasCloze) : data.words;
    const progress = data.skills.filter((s) => s.skill === SKILL_OF_MODE[mode]).map((s) => ({ ...s, repetitions: s.step }));
    return orderQueue(usable, progress, new Date(), 16).queue.map((word) => ({ word, mode }));
  }, [data, mode]);
  if (!me?.classId) return <p>Rejoignez d'abord une classe. <Link to="/eleve" className="underline">Accueil</Link></p>;
  if (!data || !frozen) return <p>Préparation de votre séance…</p>;
  if (!frozen.length)
    return (
      <div className="word-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-3xl font-bold">Rien à réviser ici</h1>
        <p className="mt-2 text-muted-foreground">{mode === "context" ? "Vos listes n'ont pas encore de phrases d'exemple." : "Aucun mot dans vos listes pour l'instant."}</p>
        <Button asChild className="mt-6"><Link to="/eleve">Accueil</Link></Button>
      </div>
    );
  return <ReviewSession key={mode ?? "daily"} title={mode ? MODE_LABELS[mode] ?? "Entraînement" : "Séance du jour"} items={frozen} pool={data.words} onQuit={() => navigate({ to: "/eleve" })} />;
}
