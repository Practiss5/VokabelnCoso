import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TeacherOnly } from "@/components/TeacherOnly";
import { Button } from "@/components/ui/button";
import { buildQuiz, QUIZ_MODE_LABELS, type QuizMode, type QuizQuestion } from "@/lib/quiz";
import { germanVoice, spokenGerman } from "@/lib/speech";

export const Route = createFileRoute("/_authenticated/enseignant/quiz/$classId")({
  head: () => ({ meta: [{ title: "Quiz au tableau — Vocabulaire Allemand" }, { name: "description", content: "Quiz projeté en classe, les élèves répondent sur leur appareil." }, { property: "og:title", content: "Quiz au tableau — Vocabulaire Allemand" }, { property: "og:description", content: "Quiz projeté en classe, les élèves répondent sur leur appareil." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => (<AppShell><TeacherOnly><QuizBoard /></TeacherOnly></AppShell>),
});

const LETTERS = ["A", "B", "C", "D"];
type Session = { id: string; status: string; format: string; q_idx: number; q_started_at: string | null; questions: QuizQuestion[] };

function speak(text: string) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(spokenGerman(text));
  const v = germanVoice(synth.getVoices());
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "de-DE";
  u.rate = 0.85;
  synth.speak(u);
}

function QuizBoard() {
  const { classId } = Route.useParams();
  const [session, setSession] = useState<Session | null>(null);
  const { data: setup } = useQuery({
    queryKey: ["quiz-setup", classId],
    queryFn: async () => {
      const [lists, students, codes] = await Promise.all([
        supabase.from("list_assignments").select("vocab_lists(id, title)").eq("class_id", classId),
        supabase.from("profiles").select("id, full_name").eq("class_id", classId),
        supabase.from("student_codes").select("student_id, label").eq("class_id", classId),
      ]);
      const labels = new Map((codes.data ?? []).filter((c) => c.student_id).map((c) => [c.student_id as string, c.label]));
      return {
        lists: (lists.data ?? []).map((l) => l.vocab_lists).filter(Boolean) as { id: string; title: string }[],
        names: new Map((students.data ?? []).map((s) => [s.id, labels.get(s.id) || s.full_name || "Élève"])),
      };
    },
  });
  if (!setup) return <p>Chargement…</p>;
  return (
    <div className="space-y-6">
      <Link to="/enseignant/classes/$classId" params={{ classId }} className="text-sm underline">← Retour à la classe</Link>
      {session ? <Board session={session} setSession={setSession} names={setup.names} /> : <Setup classId={classId} lists={setup.lists} onStart={setSession} />}
    </div>
  );
}

function Setup({ classId, lists, onStart }: { classId: string; lists: { id: string; title: string }[]; onStart: (s: Session) => void }) {
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [modes, setModes] = useState<QuizMode[]>(["choice"]);
  const [format, setFormat] = useState<"collective" | "top3">("collective");
  const [count, setCount] = useState(10);
  async function create() {
    if (!listId || !modes.length) { toast.error("Choisissez une liste et au moins un mode."); return; }
    const { data: words } = await supabase.from("words").select("id, german, french").eq("list_id", listId);
    if (!words || words.length < 4) { toast.error("Il faut au moins 4 mots dans la liste."); return; }
    const { data: u } = await supabase.auth.getUser();
    const questions = buildQuiz(words, modes, count);
    // Close any older quiz of this class so students join the new one.
    await supabase.from("quiz_sessions").update({ status: "ended" }).eq("class_id", classId).neq("status", "ended");
    const { data, error } = await supabase.from("quiz_sessions").insert({ class_id: classId, teacher_id: u.user!.id, list_id: listId, format, questions }).select().single();
    if (error) { toast.error(error.message); return; }
    onStart(data as unknown as Session);
  }
  const toggle = (m: QuizMode) => setModes((x) => x.includes(m) ? x.filter((y) => y !== m) : [...x, m]);
  return (
    <section className="word-card space-y-5">
      <h1 className="text-3xl font-bold">📺 Quiz au tableau</h1>
      <label className="block space-y-1"><span className="font-medium">Liste</span>
        <select className="w-full rounded-md border bg-background p-2" value={listId} onChange={(e) => setListId(e.target.value)}>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
      </label>
      <div className="space-y-1"><p className="font-medium">Modes</p>
        <div className="flex flex-wrap gap-2">{(["choice", "audio", "typing"] as QuizMode[]).map((m) => (
          <Button key={m} type="button" variant={modes.includes(m) ? "default" : "outline"} onClick={() => toggle(m)} aria-pressed={modes.includes(m)}>
            {QUIZ_MODE_LABELS[m]} {m === "typing" ? "(45 s)" : "(20 s)"}
          </Button>))}</div>
      </div>
      <div className="space-y-1"><p className="font-medium">Formule</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={format === "collective" ? "default" : "outline"} onClick={() => setFormat("collective")}>🤝 Défi collectif</Button>
          <Button type="button" variant={format === "top3" ? "default" : "outline"} onClick={() => setFormat("top3")}>🏆 Top 3 amical</Button>
        </div>
      </div>
      <label className="block space-y-1"><span className="font-medium">Nombre de questions</span>
        <select className="rounded-md border bg-background p-2" value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <Button size="lg" onClick={create} disabled={!lists.length}>Créer le quiz</Button>
    </section>
  );
}

function Board({ session, setSession, names }: { session: Session; setSession: (s: Session | null) => void; names: Map<string, string> }) {
  const [now, setNow] = useState(Date.now());
  const [replays, setReplays] = useState(0);
  const { data: answers = [] } = useQuery({
    queryKey: ["quiz-answers", session.id],
    queryFn: async () => (await supabase.from("quiz_answers").select("student_id, q_idx, correct, points").eq("session_id", session.id)).data ?? [],
    refetchInterval: 1500,
  });
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const q = session.q_idx >= 0 ? session.questions[session.q_idx] : null;
  const current = answers.filter((a) => a.q_idx === session.q_idx);
  const left = q && session.q_started_at ? Math.max(0, Math.ceil(q.seconds - (now - new Date(session.q_started_at).getTime()) / 1000)) : 0;

  async function update(patch: Partial<Session>) {
    const { data, error } = await supabase.from("quiz_sessions").update(patch).eq("id", session.id).select().single();
    if (error) { toast.error(error.message); return; }
    setSession(data as unknown as Session);
  }
  async function next() {
    const idx = session.q_idx + 1;
    if (idx >= session.questions.length) return update({ status: "ended" });
    setReplays(0);
    await update({ q_idx: idx, status: "question", q_started_at: new Date().toISOString() });
    const nq = session.questions[idx];
    if (nq?.mode === "audio") speak(nq.prompt);
  }
  const revealed = useRef(-1);
  useEffect(() => {
    if (session.status === "question" && q && left === 0 && revealed.current !== session.q_idx) {
      revealed.current = session.q_idx; void update({ status: "reveal" });
    }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const totalCorrect = answers.filter((a) => a.correct).length;
  const rate = answers.length ? Math.round((totalCorrect / answers.length) * 100) : 0;
  const scores = new Map<string, number>();
  for (const a of answers) scores.set(a.student_id, (scores.get(a.student_id) ?? 0) + a.points);
  const top3 = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const Summary = () => session.format === "collective" ? (
    <div className="space-y-2">
      <p className="text-xl font-bold">🤝 La classe : {rate} % de bonnes réponses ({totalCorrect} au total)</p>
      <div className="h-6 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${rate}%` }} /></div>
    </div>
  ) : (
    <ol className="space-y-2 text-2xl font-bold">
      {top3.map(([id, pts], i) => <li key={id}>{["🥇", "🥈", "🥉"][i]} {names.get(id) ?? "Élève"} — {pts} pts</li>)}
      {!top3.length && <li className="text-base text-muted-foreground">Pas encore de points.</li>}
    </ol>
  );

  if (session.status === "lobby") return (
    <section className="word-card space-y-4 text-center">
      <h1 className="text-4xl font-bold">📺 Quiz prêt !</h1>
      <p className="text-xl">Élèves : ouvrez l'application, le bouton « Rejoindre le quiz » apparaît sur votre page d'accueil.</p>
      <p className="text-muted-foreground">{session.questions.length} questions · {session.format === "collective" ? "Défi collectif" : "Top 3 amical"}</p>
      <Button size="lg" onClick={next}>▶️ Lancer la première question</Button>
    </section>
  );
  if (session.status === "ended") return (
    <section className="word-card space-y-6 text-center">
      <h1 className="text-4xl font-bold">🎉 Quiz terminé !</h1>
      <Summary />
      <Button onClick={() => setSession(null)}>Nouveau quiz</Button>
    </section>
  );
  return (
    <section className="word-card space-y-6">
      <div className="flex items-center justify-between text-lg">
        <span>Question {session.q_idx + 1}/{session.questions.length} · {QUIZ_MODE_LABELS[q!.mode]}</span>
        <span className="text-3xl font-bold tabular-nums">{session.status === "question" ? `⏱ ${left} s` : "⏹"}</span>
      </div>
      <div className="text-center">
        {q!.mode === "audio" ? (
          <div className="space-y-3">
            <p className="text-3xl font-bold">🎧 Écoutez le mot</p>
            <Button size="lg" variant="outline" disabled={replays >= 2} onClick={() => { setReplays((r) => r + 1); speak(q!.prompt); }}>🔊 Réécouter ({replays}/2)</Button>
            {session.status === "reveal" && <p className="text-3xl">{q!.prompt}</p>}
          </div>
        ) : <p className="text-5xl font-bold">{q!.prompt}</p>}
      </div>
      {q!.options.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {q!.options.map((o, i) => (
            <div key={o} className={`rounded-xl border-2 p-4 text-2xl font-semibold ${session.status === "reveal" && o === q!.answer ? "border-primary bg-primary/15" : ""}`}>
              <span className="mr-2 text-muted-foreground">{LETTERS[i]}</span>{o}
            </div>
          ))}
        </div>
      )}
      {q!.mode === "typing" && session.status === "reveal" && <p className="text-center text-4xl font-bold text-primary">{q!.answer}</p>}
      <p className="text-center text-lg">{current.length}/{names.size} réponses{session.status === "reveal" ? ` · ${current.filter((a) => a.correct).length} justes` : ""}</p>
      {session.status === "reveal" && <Summary />}
      <div className="flex flex-wrap justify-center gap-2">
        {session.status === "question" && <Button variant="outline" onClick={() => { revealed.current = session.q_idx; void update({ status: "reveal" }); }}>Afficher la réponse</Button>}
        {session.status === "reveal" && <Button size="lg" onClick={next}>{session.q_idx + 1 >= session.questions.length ? "Terminer" : "Question suivante ▶️"}</Button>}
        <Button variant="ghost" onClick={() => update({ status: "ended" })}>Arrêter le quiz</Button>
      </div>
    </section>
  );
}
