import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { answerQuiz } from "@/lib/quiz.functions";

type State = {
  id: string; status: string; format: string; q_idx: number; total: number; points: number; started_at: string | null;
  question: { mode: string; prompt: string | null; options: string[]; seconds: number; answer: string | null } | null;
  mine: { correct: boolean; given: string } | null;
} | null;

const LETTERS = ["A", "B", "C", "D"];

/** Live class quiz for students: appears only while the teacher runs one. */
export function StudentQuiz() {
  const [joined, setJoined] = useState(false);
  const [typed, setTyped] = useState("");
  const [sending, setSending] = useState(false);
  const [pin, setPin] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const { data: s, refetch } = useQuery({
    queryKey: ["quiz-for-me"],
    queryFn: async () => { const { data } = await supabase.rpc("quiz_for_me"); return (data ?? null) as State; },
    refetchInterval: joined ? 1500 : 8000,
  });
  useEffect(() => setTyped(""), [s?.q_idx]);
  async function joinPin(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase.rpc("quiz_join_pin", { _pin: pin.trim() });
    if (!data) { toast.error("Code PIN inconnu ou quiz terminé."); return; }
    setJoined(true); setPinOpen(false); void refetch();
  }
  if (!s) return pinOpen ? (
    <form onSubmit={joinPin} className="word-card flex flex-wrap items-center gap-2">
      <span className="font-medium">📺 Code PIN du quiz :</span>
      <Input className="w-32 font-mono" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} autoFocus />
      <Button disabled={pin.length !== 6}>Rejoindre</Button>
      <Button type="button" variant="ghost" onClick={() => setPinOpen(false)}>Annuler</Button>
    </form>
  ) : (
    <button type="button" className="text-sm underline text-muted-foreground" onClick={() => setPinOpen(true)}>📺 Rejoindre un quiz avec un code PIN</button>
  );
  if (!joined) return (
    <section className="word-card flex flex-col items-center gap-3 border-2 border-primary text-center">
      <p className="text-xl font-bold">📺 Ton professeur a lancé un quiz !</p>
      <Button size="lg" onClick={() => setJoined(true)}>Rejoindre le quiz</Button>
    </section>
  );
  async function send(given: string) {
    if (!s || sending) return;
    setSending(true);
    const r = await answerQuiz({ data: { session: s.id, q_idx: s.q_idx, given } }).catch(() => ({ error: "Réseau indisponible." }));
    setSending(false);
    if (r.error) toast.error(r.error);
    void refetch();
  }
  const q = s.question;
  return (
    <section className="word-card space-y-4 border-2 border-primary">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>📺 Quiz {s.q_idx >= 0 ? `· ${s.q_idx + 1}/${s.total}` : ""}</span>
        {s.format === "top3" && <span>{s.points} pts</span>}
      </div>
      {s.status === "lobby" || !q ? <p className="text-center text-lg">Regarde le tableau, ça va commencer…</p>
        : s.mine ? (
          <p className="text-center text-xl font-bold">{s.status === "reveal" ? (s.mine.correct ? "✅ Bravo !" : `❌ C'était : ${q.answer}`) : "Réponse envoyée ✔️ Regarde le tableau."}</p>
        ) : s.status === "reveal" ? (
          <p className="text-center text-xl">⏹ Temps écoulé. Réponse : <b>{q.answer}</b></p>
        ) : q.mode === "typing" ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) void send(typed); }}>
            <p className="text-center text-2xl font-bold">{q.prompt}</p>
            <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="En allemand, avec l'article" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            <Button className="w-full" size="lg" disabled={sending}>Valider</Button>
          </form>
        ) : (
          <div className="space-y-3">
            {q.prompt ? <p className="text-center text-2xl font-bold">{q.prompt}</p> : <p className="text-center text-lg">🎧 Écoute le mot au tableau</p>}
            <div className="grid grid-cols-2 gap-3">
              {q.options.map((o, i) => (
                <Button key={o} size="lg" variant="outline" className="h-auto min-h-16 whitespace-normal text-lg" disabled={sending} onClick={() => send(o)}>
                  <b className="mr-1">{LETTERS[i]}</b> {o}
                </Button>
              ))}
            </div>
          </div>
        )}
      {s.status === "reveal" && s.format === "top3" && <p className="text-center text-sm">Le Top 3 est affiché au tableau 🏆</p>}
    </section>
  );
}
