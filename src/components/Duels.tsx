import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Q = { done: boolean; index?: number; total?: number; german?: string; choices?: string[] };

/** Duel result for the student: win / loss / tie, ties broken by total time. */
export function duelOutcome(me: { score: number; ms: number }, opp: { score: number; ms: number }): "win" | "loss" | "tie" {
  if (me.score !== opp.score) return me.score > opp.score ? "win" : "loss";
  if (me.ms !== opp.ms) return me.ms < opp.ms ? "win" : "loss";
  return "tie";
}

function Play({ duelId, onEnd }: { duelId: string; onEnd: () => void }) {
  const { data: q, refetch } = useQuery({
    queryKey: ["duel-q", duelId],
    queryFn: async () => { const { data, error } = await supabase.rpc("duel_question", { _duel: duelId }); if (error) throw error; return data as Q; },
    staleTime: Infinity,
  });
  const [feedback, setFeedback] = useState<{ choice: string; answer: string; correct: boolean } | null>(null);
  async function pick(c: string) {
    if (feedback) return;
    const { data, error } = await supabase.rpc("answer_duel", { _duel: duelId, _choice: c });
    if (error) { toast.error(error.message); return; }
    const r = data as { correct: boolean; answer: string };
    setFeedback({ choice: c, ...r });
    setTimeout(() => { setFeedback(null); void refetch(); }, 900);
  }
  if (!q) return <p>Chargement…</p>;
  if (q.done) return (
    <div className="space-y-3 text-center">
      <p className="text-xl font-bold">Duel terminé ! 🎉</p>
      <p className="text-sm text-muted-foreground">Le résultat s'affiche dès que ton camarade a joué.</p>
      <Button onClick={onEnd}>Retour</Button>
    </div>
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Question {(q.index ?? 0) + 1}/{q.total} · sois rapide !</p>
      <p className="text-3xl font-bold">{q.german}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.choices?.map((c) => {
          const state = feedback && (c === feedback.answer ? "border-success bg-success/15" : c === feedback.choice ? "border-destructive bg-destructive/15" : "");
          return <button key={c} onClick={() => pick(c)} className={`word-card border-2 p-3 text-left text-lg ${state || ""}`}>{c}</button>;
        })}
      </div>
    </div>
  );
}

export function StudentDuels({ listId }: { listId: string | undefined }) {
  const qc = useQueryClient();
  const [playing, setPlaying] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["my-duels"],
    queryFn: async () => { const { data, error } = await supabase.rpc("my_duels"); if (error) throw error; return data ?? []; },
  });
  async function start() {
    if (!listId) return;
    const { data: id, error } = await supabase.rpc("start_duel", { _list: listId });
    if (error) { toast.error(error.message); return; }
    setPlaying(id as string);
  }
  function end() { setPlaying(null); void qc.invalidateQueries({ queryKey: ["my-duels"] }); }
  if (playing) return <section className="word-card border-2 border-primary p-5"><Play duelId={playing} onEnd={end} /></section>;
  const now = Date.now();
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">⚔️ Duels amicaux</h2>
        <Button onClick={start} disabled={!listId}>Défier un camarade au hasard</Button>
      </div>
      <p className="text-sm text-muted-foreground">10 QCM sur la liste choisie ci-dessus. Ton camarade a 48 h pour jouer. Seuls vous deux voyez le résultat.</p>
      {data?.map((d) => {
        const expired = new Date(d.expires_at).getTime() < now;
        let status: string;
        if (d.opp_score !== null && d.opp_score !== undefined) {
          const o = duelOutcome({ score: d.my_score, ms: d.my_ms }, { score: d.opp_score, ms: d.opp_ms ?? 0 });
          status = `${o === "win" ? "Gagné 🏆" : o === "loss" ? "Perdu" : "Égalité"} ${d.my_score}-${d.opp_score}`;
        } else if (d.my_finished) status = expired ? `Ton score : ${d.my_score}/${d.total} (camarade absent)` : `Ton score : ${d.my_score}/${d.total} · en attente de ${d.opponent}`;
        else status = expired ? "Expiré" : d.my_idx > 0 ? `En cours ${d.my_idx}/${d.total}` : "À jouer !";
        const canPlay = !d.my_finished && !expired;
        return (
          <div key={d.duel_id} className="word-card flex flex-wrap items-center justify-between gap-2 p-3">
            <div><p className="font-semibold">vs {d.opponent} · {d.list_title}</p><p className="text-sm text-muted-foreground">{status}</p></div>
            {canPlay && <Button size="sm" onClick={() => setPlaying(d.duel_id)}>{d.my_idx > 0 ? "Continuer" : "Jouer"}</Button>}
          </div>
        );
      })}
    </section>
  );
}
