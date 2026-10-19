import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { meQuery } from "@/lib/session";
import { dailyQuery } from "@/lib/daily";
import { AppShell } from "@/components/AppShell";
import { ReviewSession, type SessionItem } from "@/components/ReviewSession";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/eleve/seance")({
  head: () => ({ meta: [{ title: "Séance du jour — Vocabulaire Allemand" }, { name: "description", content: "Votre séance personnalisée de 5 à 10 minutes." }] }),
  component: () => (
    <AppShell>
      <Daily />
    </AppShell>
  ),
});

function Daily() {
  const { data: me } = useSuspenseQuery(meQuery);
  const navigate = useNavigate();
  const { data } = useQuery({ ...dailyQuery(me!.id, me!.classId ?? ""), enabled: !!me?.classId, staleTime: Infinity });
  // Freeze the selection once loaded so it does not change mid-session.
  const [items] = useState<SessionItem[] | null>(null);
  const frozen = items ?? data?.items;
  if (!me?.classId) return <p>Rejoignez d'abord une classe. <Link to="/eleve" className="underline">Accueil</Link></p>;
  if (!data || !frozen) return <p>Préparation de votre séance…</p>;
  if (!frozen.length)
    return (
      <div className="word-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-3xl font-bold">Rien à réviser aujourd'hui</h1>
        <p className="mt-2 text-muted-foreground">Aucun mot dans vos listes pour l'instant.</p>
        <Button asChild className="mt-6"><Link to="/eleve">Accueil</Link></Button>
      </div>
    );
  return <ReviewSession title="Séance du jour" items={frozen} pool={data.words} onQuit={() => navigate({ to: "/eleve" })} />;
}
