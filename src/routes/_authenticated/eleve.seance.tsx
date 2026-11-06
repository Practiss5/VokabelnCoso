import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { meQuery } from "@/lib/session";
import { dailyQuery } from "@/lib/daily";
import { DAILY_GOAL, hasCloze, MODE_LABELS, orderQueue, type DailyMode } from "@/lib/vocab";
import { AppShell } from "@/components/AppShell";
import { ReviewSession, type SessionItem } from "@/components/ReviewSession";
import { Button } from "@/components/ui/button";
import { selectTrainingList, trainingListsQuery } from "@/lib/training-lists";
import { useActiveHomeworkId, useHomeworkTimer } from "@/lib/study-time";

const MODES: DailyMode[] = ["flashcard", "choice", "speaking", "typing", "context", "dictation", "listen"];
const SKILL_OF_MODE = { flashcard: "recognition", choice: "translation", speaking: "speaking", typing: "writing", context: "context", dictation: "writing", listen: "translation" } as const;

export const Route = createFileRoute("/_authenticated/eleve/seance")({
  validateSearch: (s: Record<string, unknown>): { mode?: DailyMode; listId?: string } => ({
    ...(MODES.includes(s['mode'] as DailyMode) ? { mode: s['mode'] as DailyMode } : {}),
    ...(typeof s['listId'] === "string" ? { listId: s['listId'] } : {}),
  }),
  head: () => ({ meta: [{ title: "Séance du jour — Vocabulaire Allemand" }, { name: "description", content: "Votre séance personnalisée de 5 à 10 minutes." }, { property: "og:title", content: "Séance du jour — Vocabulaire Allemand" }, { property: "og:description", content: "Votre séance personnalisée de 5 à 10 minutes." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => (
    <AppShell>
      <Daily />
    </AppShell>
  ),
});

function Daily() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { mode, listId: requestedList } = Route.useSearch();
  const navigate = useNavigate();
  const { data: lists } = useQuery(trainingListsQuery(me?.classId ?? ""));
  const listId = selectTrainingList(lists ?? [], requestedList);
  const selectedList = lists?.find((list) => list.id === listId);
  const { data } = useQuery({ ...dailyQuery(me?.id ?? "", me?.classId ?? "", listId), enabled: Boolean(me?.classId && lists), staleTime: Infinity });
  useHomeworkTimer(useActiveHomeworkId(listId ?? "", undefined));
  // Freeze the selection once loaded so it does not change mid-session.
  const frozen = useMemo<SessionItem[] | null>(() => {
    if (!data) return null;
    if (!mode) return data.items;
    // Chosen step: selected list words, ordered by that skill's own schedule.
    const usable = mode === "context" ? data.words.filter(hasCloze) : data.words;
    const progress = data.skills.filter((s) => s.skill === SKILL_OF_MODE[mode]).map((s) => ({ ...s, repetitions: s.step }));
    return orderQueue(usable, progress, new Date(), DAILY_GOAL).queue.map((word) => ({ word, mode }));
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
  return <ReviewSession key={`${listId ?? "none"}:${mode ?? "daily"}`} title={`${selectedList?.title ?? "Séance du jour"}${mode ? ` · ${MODE_LABELS[mode] ?? "Entraînement"}` : ""}`} items={frozen} pool={data.words} onQuit={() => navigate({ to: "/eleve" })} />;
}
