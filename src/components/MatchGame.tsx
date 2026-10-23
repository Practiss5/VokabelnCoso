import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bestRun, buildWaves, waveCards, type MatchWord } from "@/lib/match";
import { Button } from "@/components/ui/button";

/** Fast pair-matching game. Does not touch spaced repetition or homework; feeds the daily flame only. */
export function MatchGame({ listId, words, onQuit }: { listId: string; words: MatchWord[]; onQuit: () => void }) {
  const qc = useQueryClient();
  const [round, setRound] = useState(0);
  const waves = useMemo(() => buildWaves(words), [words, round]);
  const [wi, setWi] = useState(0);
  const cards = useMemo(() => waveCards(waves[wi] ?? []), [waves, wi]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const run = (() => { let c = 0; for (let i = results.length - 1; i >= 0 && results[i]; i--) c++; return c; })();
  const pairs = results.filter(Boolean).length;

  const top = useQuery({
    queryKey: ["match-top", listId],
    queryFn: async () => (await supabase.rpc("class_match_top", { _list: listId })).data ?? [],
  });

  function tap(key: string) {
    const card = cards.find((c) => c.key === key)!;
    if (found.has(card.wordId) || wrong.length) return;
    if (!sel) { setSel(key); return; }
    const first = cards.find((c) => c.key === sel)!;
    if (first.key === key) { setSel(null); return; }
    if (first.side === card.side) { setSel(key); return; }
    const ok = first.wordId === card.wordId;
    setResults((r) => [...r, ok]);
    setSel(null);
    if (ok) setFound((f) => new Set(f).add(card.wordId));
    else { setWrong([first.key, key]); setTimeout(() => setWrong([]), 600); }
  }

  useEffect(() => {
    if (!waves[wi] || found.size < waves[wi].length) return;
    const t = setTimeout(() => {
      if (wi + 1 < waves.length) { setWi(wi + 1); setFound(new Set()); }
      else setFinished(true);
    }, 350);
    return () => clearTimeout(t);
  }, [found, wi, waves]);

  useEffect(() => {
    if (!finished) return;
    supabase.rpc("record_match", { _list: listId, _pairs: pairs, _best_run: bestRun(results) }).then(({ error }) => {
      if (error) toast.error("Score non enregistré : " + error.message);
      qc.invalidateQueries({ queryKey: ["match-top", listId] });
      qc.invalidateQueries({ queryKey: ["streak"] });
      qc.invalidateQueries({ queryKey: ["daily"] });
    });
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  function restart() { setRound((r) => r + 1); setWi(0); setFound(new Set()); setResults([]); setFinished(false); setSel(null); }

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

  if (finished)
    return (
      <div className="space-y-6">
        <div className="word-card space-y-2 p-6 text-center">
          <p className="text-5xl">⚡</p>
          <h2 className="text-3xl font-bold">Partie terminée !</h2>
          <p className="text-lg">Meilleure série sans faute : <b>{bestRun(results)} 🔥</b></p>
          <p className="text-sm text-muted-foreground">{pairs} paires trouvées · {results.length - pairs} erreur(s)</p>
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
        <span className="text-sm text-muted-foreground">Vague {wi + 1}/{waves.length}</span>
        <span className={`text-lg font-bold ${run >= 3 ? "text-accent" : ""}`}>{run} d'affilée {run ? "🔥" : ""}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => {
          const done = found.has(c.wordId);
          const isWrong = wrong.includes(c.key);
          return (
            <button key={c.key} onClick={() => tap(c.key)} disabled={done}
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
