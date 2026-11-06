import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { type Card, type MatchWord } from "@/lib/match";
import { Button } from "@/components/ui/button";

/** Fast pair-matching game. Does not touch spaced repetition or homework; feeds the daily flame only. */
export function MatchGame({ listId, onQuit }: { listId: string; words: MatchWord[]; onQuit: () => void }) {
  const qc = useQueryClient();
  type State = { id: string; cards: Card[]; wave: number; totalWaves: number; pairs: number; run: number; bestRun: number; finished: boolean; found?: string[]; correct?: boolean; newWave?: boolean };
  const [game, setGame] = useState<State | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [errors, setErrors] = useState(0);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const cards = game?.cards ?? [];
  const found = new Set(game?.found ?? []);
  const finished = game?.finished ?? false;
  const run = game?.run ?? 0;
  const pairs = game?.pairs ?? 0;

  async function restart() {
    setBusy(true); setLoadError(false); setSel(null); setWrong([]); setErrors(0);
    const { data, error } = await supabase.rpc("start_match_session", { _list: listId });
    if (error) { setLoadError(true); toast.error("Partie indisponible. Réessaie."); }
    else setGame(data as unknown as State);
    setBusy(false);
  }
  useEffect(() => { void restart(); }, [listId]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = useQuery({
    queryKey: ["match-top", listId],
    queryFn: async () => (await supabase.rpc("class_match_top", { _list: listId })).data ?? [],
  });

  async function tap(key: string) {
    const card = cards.find((c) => c.key === key);
    if (!card || !game || busy || submitting.current || found.has(card.wordId) || wrong.length) return;
    if (!sel) { setSel(key); return; }
    const first = cards.find((c) => c.key === sel);
    if (!first || first.key === key) { setSel(null); return; }
    if (first.side === card.side) { setSel(key); return; }
    submitting.current = true; setBusy(true);
    try {
      const { data, error } = await supabase.rpc("play_match_turn", { _session: game.id, _first: first.key, _second: card.key });
      if (error) { toast.error("Paire non enregistrée. Réessaie."); return; }
      const next = data as unknown as State;
      setSel(null);
      if (!next.correct) { setErrors((e) => e + 1); setWrong([first.key, key]); setTimeout(() => setWrong([]), 600); }
      if (next.newWave) await new Promise((resolve) => setTimeout(resolve, 350));
      setGame(next);
      if (next.finished) {
        qc.invalidateQueries({ queryKey: ["match-top", listId] });
        qc.invalidateQueries({ queryKey: ["streak"] });
        qc.invalidateQueries({ queryKey: ["daily"] });
      }
    } finally { submitting.current = false; setBusy(false); }
  }

  const board = (
    <div className="word-card space-y-2 p-4">
      <h3 className="text-lg font-bold">🏆 Record de la classe (sans faute d'affilée)</h3>
      {top.data?.length ? (
        <ol className="space-y-1 text-sm">
          {top.data.map((t, i) => (
            <li key={i} className={`flex justify-between rounded px-2 py-1 ${t.is_me ? "bg-accent/20 font-semibold" : "bg-secondary"}`}>
              <span>{i + 1}. {t.full_name}{t.is_me ? " (toi)" : ""}</span><span>{t.best_run} 🔥</span>
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-muted-foreground">Personne n'a encore joué. Sois le premier !</p>}
    </div>
  );

  if (!game) return <div className="word-card p-6">{loadError ? <Button onClick={restart}>Réessayer</Button> : <p>Préparation de la partie…</p>}</div>;

  if (finished)
    return (
      <div className="space-y-6">
        <div className="word-card space-y-2 p-6 text-center">
          <p className="text-5xl">⚡</p>
          <h2 className="text-3xl font-bold">Partie terminée !</h2>
          <p className="text-lg">Meilleure série sans faute : <b>{game?.bestRun ?? 0} 🔥</b></p>
          <p className="text-sm text-muted-foreground">{pairs} paires trouvées · {errors} erreur(s)</p>
          <div className="flex justify-center gap-2 pt-2">
            <Button onClick={restart}>Rejouer</Button>
            <Button variant="outline" onClick={onQuit}>Choisir un autre mode</Button>
          </div>
        </div>
        {board}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onQuit} className="text-sm underline">← Quitter</button>
        <span className="text-sm text-muted-foreground">Vague {game?.wave ?? 1}/{game?.totalWaves ?? 1}</span>
        <span className={`text-lg font-bold ${run >= 3 ? "text-accent" : ""}`}>{run} d'affilée {run ? "🔥" : ""}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => {
          const done = found.has(c.wordId);
          const isWrong = wrong.includes(c.key);
          return (
            <button key={c.key} onClick={() => tap(c.key)} disabled={done || busy}
              className={`min-h-20 rounded-xl border-2 p-3 text-lg font-semibold transition-all ${
                done ? "invisible" : isWrong ? "border-destructive bg-destructive/10" : sel === c.key ? "border-primary bg-primary/10" : "border-border bg-card hover:-translate-y-0.5"
              }`}>
              {c.text}
            </button>
          );
        })}
      </div>
      {board}
    </div>
  );
}
