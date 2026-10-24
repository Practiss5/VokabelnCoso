import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { canRecognize, listenGerman } from "@/lib/recognition";
import { isSpokenCorrect, isWrittenCorrect } from "@/lib/vocab";
import {
  addLife, applyAnswer, basePoints, BOSS_SIZE, COMBO_BONUS_EVERY, COMBO_BONUS_MS, COMBO_START, COMBO_TARGET, fallDuration,
  LEVEL_NAMES, LEVEL_SKILL, LIFE_BOSS_MIN, MAX_LIVES, pickBoss, pickNext, SLOW_EVERY, SLOW_MS, START_LIVES, threeChoices,
  WORDS_PER_LEVEL, type ComboState, type SkillStat, type TLevel, type TWord,
} from "@/lib/tetris";
import { Button } from "@/components/ui/button";

const COLORS = ["bg-neon-cyan", "bg-neon-pink", "bg-neon-lime", "bg-neon-amber"];
const SPECIAL = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"];

type Phase = "intro" | "play" | "bossIntro" | "bossDone" | "over";
type Brick = { word: TWord; choices: string[]; color: string; key: number };
type Feedback = { ok: boolean; text: string; points?: number } | null;

let audioCtx: AudioContext | null = null;
function beep(freq: number, ms = 120, type: OscillatorType = "square") {
  try {
    audioCtx ??= new AudioContext();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = 0.06;
    o.connect(g); g.connect(audioCtx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    o.stop(audioCtx.currentTime + ms / 1000);
  } catch { /* no audio */ }
}

export function WortTetris({ listId, onQuit }: { listId: string; onQuit: () => void }) {
  const [data, setData] = useState<{ main: TWord[]; others: TWord[]; stats: SkillStat[]; title: string } | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [level, setLevel] = useState<TLevel>(1);
  const [boss, setBoss] = useState<TWord[] | null>(null);
  const [bossHits, setBossHits] = useState(0);
  const [inLevel, setInLevel] = useState(0);
  const [brick, setBrick] = useState<Brick | null>(null);
  const [y, setY] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [combo, setCombo] = useState<ComboState>(COMBO_START);
  const [slowInv, setSlowInv] = useState(0);
  const [comboInv, setComboInv] = useState(0);
  const [slowLeft, setSlowLeft] = useState(0);
  const [comboLeft, setComboLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [typed, setTyped] = useState("");
  const [keyboard, setKeyboard] = useState(false);
  const [sound, setSound] = useState(true);
  const [flash, setFlash] = useState("");
  const [stats, setStats] = useState({ ok: [0, 0, 0], ko: [0, 0, 0] });
  const [missed, setMissed] = useState<TWord[]>([]);
  const [saved, setSaved] = useState(false);
  const recent = useRef<string[]>([]);
  const answered = useRef(0);
  const totalOk = useRef(0);
  const keyRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const sfx = (f: number, ms?: number, t?: OscillatorType) => { if (sound) beep(f, ms, t); };

  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      const [list, words, assigned, prog] = await Promise.all([
        supabase.from("vocab_lists").select("title").eq("id", listId).single(),
        supabase.from("words").select("id, german, french").eq("list_id", listId),
        supabase.from("list_assignments").select("list_id, vocab_lists(title)"),
        supabase.from("skill_progress").select("word_id, skill, wrong_count, correct_count, step, last_error").eq("student_id", uid ?? ""),
      ]);
      const main = (words.data ?? []).map((w) => ({ ...w, listTitle: list.data?.title }));
      if (main.length < 3) { toast.error("Il faut au moins 3 mots dans la liste."); onQuit(); return; }
      const otherIds = Array.from(new Set((assigned.data ?? []).map((a) => a.list_id).filter((id) => id !== listId)));
      const titles = new Map((assigned.data ?? []).map((a) => [a.list_id, (a.vocab_lists as { title: string } | null)?.title ?? ""]));
      const st = (prog.data ?? []) as SkillStat[];
      let others: TWord[] = [];
      if (otherIds.length) {
        const ow = await supabase.from("words").select("id, german, french, list_id").in("list_id", otherIds);
        // Only words already studied and mastered somewhere come back from other lists.
        const mastered = new Set(st.filter((s) => s.step >= 2 && s.correct_count > s.wrong_count).map((s) => s.word_id));
        others = (ow.data ?? []).filter((w) => mastered.has(w.id)).map((w) => ({ id: w.id, german: w.german, french: w.french, listTitle: titles.get(w.list_id), foreign: true }));
      }
      setData({ main, others, stats: st, title: list.data?.title ?? "" });
    })();
  }, [listId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pool = data ? [...data.main, ...data.others] : [];
  const paused = phase !== "play" || !brick || feedback !== null || listening;

  function spawn(lv = level, bossQueue = boss) {
    if (!data) return;
    let w: TWord | null;
    if (bossQueue) w = bossQueue[0] ?? null;
    else w = pickNext(data.main, data.others, recent.current, answered.current);
    if (!w) return;
    recent.current = [w.id, ...recent.current].slice(0, Math.min(4, data.main.length - 1));
    keyRef.current++;
    setBrick({ word: w, choices: lv === 1 ? threeChoices(w, pool) : [], color: COLORS[keyRef.current % COLORS.length]!, key: keyRef.current });
    setY(0); setAttempts(0); setHeard(""); setTyped("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // Fall loop: only real play time counts (paused during speech, feedback, screens).
  useEffect(() => {
    if (paused) return;
    let last = performance.now(); let raf = 0;
    const dur = fallDuration(level, answered.current, !!boss);
    const tick = (now: number) => {
      const dt = now - last; last = now;
      setElapsed((e) => e + dt);
      setSlowLeft((s) => Math.max(0, s - dt));
      setComboLeft((s) => Math.max(0, s - dt));
      setY((v) => {
        const nv = v + (dt / dur) * (slowLeftRef.current > 0 ? 0.5 : 1);
        if (nv >= 1) { setTimeout(() => resolveRef.current(false, "Trop tard !"), 0); return 1; }
        return nv;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, level, boss]); // eslint-disable-line react-hooks/exhaustive-deps
  const slowLeftRef = useRef(0); slowLeftRef.current = slowLeft;
  const resolving = useRef(false);
  const resolveRef = useRef<(ok: boolean, why?: string) => void>(() => {});

  function resolve(ok: boolean, why?: string) {
    if (!brick || resolving.current) return;
    resolving.current = true;
    const lv = level; const idx = lv - 1;
    const r = applyAnswer(combo, ok, basePoints(lv, !!boss), comboLeft > 0);
    setCombo(r.combo);
    answered.current++;
    setStats((s) => ({ ok: s.ok.map((n, i) => (i === idx && ok ? n + 1 : n)), ko: s.ko.map((n, i) => (i === idx && !ok ? n + 1 : n)) }));
    let newLives = lives;
    if (ok) {
      setScore((s) => s + r.points);
      totalOk.current++;
      if (totalOk.current % SLOW_EVERY === 0) { setSlowInv((n) => Math.min(n + 1, 3)); toast("🐢 Bonus Ralentissement débloqué !"); }
      if (totalOk.current % COMBO_BONUS_EVERY === 0) { setComboInv((n) => Math.min(n + 1, 2)); toast("⚡ Bonus Combo 30 s débloqué !"); }
      if (r.armed) { setFlash("COMBO ×2 prêt !"); sfx(1200, 300, "triangle"); } else sfx(r.doubled ? 1000 : 700);
      if (boss) setBossHits((h) => h + 1);
    } else {
      newLives = lives - 1; setLives(newLives); sfx(160, 300, "sawtooth");
      setMissed((m) => (m.some((w) => w.id === brick.word.id) ? m : [...m, brick.word]));
    }
    setFeedback({ ok, text: ok ? (r.doubled ? "Bravo ! Points doublés" : "Bravo !") : `${why ?? "Raté"} → ${brick.word.german} = ${brick.word.french}`, points: r.points });
    setTimeout(() => {
      resolving.current = false; setFeedback(null); setFlash("");
      if (newLives <= 0) { setBrick(null); setPhase("over"); return; }
      if (boss) {
        const rest = boss.slice(1);
        if (!rest.length) { setBrick(null); setBoss(null); setPhase("bossDone"); return; }
        setBoss(rest); spawn(lv, rest); return;
      }
      const n = inLevel + 1; setInLevel(n);
      if (n >= WORDS_PER_LEVEL) { setBrick(null); setPhase("bossIntro"); return; }
      spawn(lv, null);
    }, ok ? 900 : 2200);
  }

  function startGame() {
    setPhase("play"); setLevel(1); setInLevel(0); setScore(0); setLives(START_LIVES); setCombo(COMBO_START);
    setSlowInv(0); setComboInv(0); setSlowLeft(0); setComboLeft(0); setElapsed(0); setStats({ ok: [0, 0, 0], ko: [0, 0, 0] });
    setMissed([]); setSaved(false); setBoss(null); answered.current = 0; totalOk.current = 0; recent.current = [];
    setTimeout(() => spawn(1, null), 0);
  }
  function startBoss() {
    if (!data) return;
    const words = pickBoss(pool, data.stats.filter((s) => s.skill === LEVEL_SKILL[level]), missed.map((w) => w.id), BOSS_SIZE);
    setBoss(words); setBossHits(0); setPhase("play"); setTimeout(() => spawn(level, words), 0);
  }
  function afterBoss() {
    if (bossHits >= LIFE_BOSS_MIN) { setLives((l) => addLife(l)); toast("❤️ Vie supplémentaire gagnée !"); }
    if (level === 3) { setPhase("over"); return; }
    const nl = (level + 1) as TLevel;
    setLevel(nl); setInLevel(0); setPhase("play"); setTimeout(() => spawn(nl, null), 0);
  }

  resolveRef.current = resolve;

  async function speak() {
    if (!brick || listening) return;
    setListening(true); setHeard("");
    try {
      const alts = await listenGerman((t) => setHeard(t)).promise;
      setListening(false);
      if (!alts.length) { setFeedbackTemp("Je n'ai rien entendu, réessaie 🎙️"); return; }
      if (isSpokenCorrect(alts, brick.word.german)) { resolve(true); return; }
      if (attempts < 1) { setAttempts(1); setHeard(alts[0]!); setFeedbackTemp(`J'ai entendu « ${alts[0]} ». Encore un essai !`); return; }
      resolve(false, `J'ai entendu « ${alts[0]} »`);
    } catch (e) {
      setListening(false);
      toast.error("Micro indisponible : " + (e as Error).message + ". Utilise le clavier.");
      setKeyboard(true);
    }
  }
  const [hint, setHint] = useState("");
  function setFeedbackTemp(t: string) { setHint(t); setTimeout(() => setHint(""), 2500); }

  function submitTyped() {
    if (!brick || !typed.trim()) return;
    resolve(isWrittenCorrect(typed, brick.word.german), `Tu as écrit « ${typed} »`);
  }

  // Save once at the end; game results never touch the spaced-repetition progress.
  useEffect(() => {
    if (phase !== "over" || saved) return;
    setSaved(true);
    void supabase.from("tetris_games").insert({
      list_id: listId, score, level_reached: level,
      translation_ok: stats.ok[0]!, translation_ko: stats.ko[0]!, speaking_ok: stats.ok[1]!, speaking_ko: stats.ko[1]!,
      writing_ok: stats.ok[2]!, writing_ko: stats.ko[2]!, missed_word_ids: missed.map((w) => w.id),
    }).then(({ error }) => { if (error) toast.error("Score non enregistré : " + error.message); });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const time = `${Math.floor(elapsed / 60000)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, "0")}`;
  const shell = "rounded-2xl bg-arcade p-4 text-arcade-fg shadow-2xl sm:p-6";

  if (!data) return <div className={shell}><p className="text-center">Chargement du jeu…</p></div>;

  if (phase === "intro")
    return (
      <div className={`${shell} space-y-4 text-center`}>
        <h1 className="text-4xl font-black tracking-widest text-neon-cyan drop-shadow-[0_0_12px_currentColor]">WORT-TETRIS</h1>
        <p className="text-sm opacity-80">Liste : {data.title}</p>
        <div className="mx-auto max-w-md space-y-1 text-left text-sm">
          <p>🧱 Réponds avant que la brique touche le sol. Tu as {START_LIVES} vies.</p>
          <p>1️⃣ Traduction · 2️⃣ Prononciation · 3️⃣ Orthographe — {WORDS_PER_LEVEL} mots puis un <b>boss</b> de tes mots difficiles.</p>
          <p>🔥 {COMBO_TARGET} bonnes réponses d'affilée = le mot suivant vaut ×2.</p>
          <p>🐢 Ralentissement 5 s : toutes les {SLOW_EVERY} bonnes réponses.</p>
          <p>⚡ Combo 30 s (points ×2) : toutes les {COMBO_BONUS_EVERY} bonnes réponses.</p>
          <p>❤️ Vie en plus : réussis au moins {LIFE_BOSS_MIN} mots du boss (max {MAX_LIVES}).</p>
          <p className="opacity-70">Ne compte pas pour les devoirs et n'efface pas ta progression.</p>
        </div>
        <div className="flex justify-center gap-2">
          <Button onClick={startGame} size="lg">▶ Jouer</Button>
          <Button variant="outline" onClick={onQuit}>Retour</Button>
        </div>
      </div>
    );

  if (phase === "bossIntro" || phase === "bossDone")
    return (
      <div className={`${shell} space-y-4 text-center`}>
        {phase === "bossIntro" ? (
          <>
            <p className="text-6xl">👾</p>
            <h2 className="text-3xl font-black text-neon-pink">BOSS — {LEVEL_NAMES[level]}</h2>
            <p>{BOSS_SIZE} de tes mots les plus difficiles, plus rapides, points ×2.</p>
            <Button onClick={startBoss} size="lg">Affronter le boss</Button>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-black text-neon-lime">Boss terminé : {bossHits}/{BOSS_SIZE}</h2>
            {bossHits >= LIFE_BOSS_MIN ? <p>❤️ +1 vie !</p> : <p>Pas de vie bonus cette fois.</p>}
            <Button onClick={afterBoss} size="lg">{level === 3 ? "Voir mon score" : `Niveau ${level + 1} : ${LEVEL_NAMES[(level + 1) as TLevel]}`}</Button>
          </>
        )}
      </div>
    );

  if (phase === "over") {
    const ok = stats.ok.reduce((a, b) => a + b, 0); const ko = stats.ko.reduce((a, b) => a + b, 0);
    return (
      <div className={`${shell} space-y-4 text-center`}>
        <h2 className="text-4xl font-black text-neon-amber">{lives > 0 ? "VICTOIRE !" : "GAME OVER"}</h2>
        <p className="text-2xl font-bold">Score : {score}</p>
        <p className="text-sm">⏱ {time} · ✅ {ok} · ❌ {ko}</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {([1, 2, 3] as TLevel[]).map((l) => <div key={l} className="rounded-lg border border-neon-cyan/40 p-2">{LEVEL_NAMES[l]}<br />✅ {stats.ok[l - 1]} · ❌ {stats.ko[l - 1]}</div>)}
        </div>
        {missed.length > 0 && (
          <div className="text-left">
            <p className="font-bold">Mots à revoir :</p>
            <ul className="text-sm">{missed.map((w) => <li key={w.id}>{w.german} — {w.french}</li>)}</ul>
          </div>
        )}
        <div className="flex justify-center gap-2">
          <Button onClick={startGame}>Rejouer</Button>
          <Button variant="outline" onClick={onQuit}>Retour à l'apprentissage</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${shell} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button onClick={onQuit} className="underline">← Quitter</button>
        <span className="font-bold text-neon-cyan">{boss ? "👾 BOSS · " : ""}Niv. {level} {LEVEL_NAMES[level]}{!boss && ` · ${inLevel}/${WORDS_PER_LEVEL}`}</span>
        <span>⏱ {time}</span>
        <button onClick={() => setSound((s) => !s)} aria-label="Son">{sound ? "🔊" : "🔇"}</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-2xl font-black text-neon-amber">{score}</span>
        <span aria-label={`${lives} vies`}>{"❤️".repeat(lives)}</span>
        <div className="flex items-center gap-1" aria-label="Combo">
          {Array.from({ length: COMBO_TARGET }, (_, i) => (
            <span key={i} className={`h-3 w-3 rounded-full ${combo.ready || i < combo.streak ? "bg-neon-pink shadow-[0_0_8px] shadow-neon-pink" : "bg-arcade-fg/20"}`} />
          ))}
          {combo.ready && <span className="ml-1 text-xs font-bold text-neon-pink">×2</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={!slowInv || slowLeft > 0 || paused} onClick={() => { setSlowInv((n) => n - 1); setSlowLeft(SLOW_MS); sfx(400, 200, "triangle"); }}>
          🐢 {slowLeft > 0 ? `${(slowLeft / 1000).toFixed(1)} s` : `Ralentir (${slowInv})`}
        </Button>
        <Button size="sm" variant="secondary" disabled={!comboInv || comboLeft > 0 || paused} onClick={() => { setComboInv((n) => n - 1); setComboLeft(COMBO_BONUS_MS); sfx(900, 250, "triangle"); }}>
          ⚡ {comboLeft > 0 ? `×2 ${Math.ceil(comboLeft / 1000)} s` : `Combo 30 s (${comboInv})`}
        </Button>
      </div>

      <div className="relative h-72 overflow-hidden rounded-xl border-2 border-neon-cyan/50 bg-[linear-gradient(transparent_95%,color-mix(in_oklab,var(--color-neon-cyan)_15%,transparent)_95%)] bg-[length:100%_24px] sm:h-80">
        {flash && <p className="absolute inset-x-0 top-2 z-10 animate-pulse text-center text-xl font-black text-neon-pink">{flash}</p>}
        {brick && (
          <div key={brick.key} className={`absolute left-1/2 w-[85%] max-w-sm -translate-x-1/2 rounded-lg ${brick.color} px-4 py-3 text-center text-xl font-black text-arcade shadow-[0_0_20px] shadow-current sm:text-2xl ${feedback ? (feedback.ok ? "scale-110 opacity-60 transition-all" : "animate-pulse") : ""}`}
            style={{ top: `calc(${y * 100}% - ${y * 64}px)` }}>
            {level === 1 ? brick.word.german : brick.word.french}
            {brick.word.foreign && <span className="block text-xs font-normal opacity-80">📚 {brick.word.listTitle}</span>}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-neon-pink shadow-[0_0_12px] shadow-neon-pink" />
      </div>

      {feedback ? (
        <p className={`rounded-lg p-3 text-center font-bold ${feedback.ok ? "bg-neon-lime/20 text-neon-lime" : "bg-neon-pink/20 text-neon-pink"}`}>
          {feedback.text}{feedback.ok ? ` +${feedback.points}` : ""}
        </p>
      ) : brick && level === 1 ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {brick.choices.map((c) => <Button key={c} variant="outline" className="h-auto min-h-12 whitespace-normal border-neon-cyan/60 bg-arcade text-base text-arcade-fg hover:bg-neon-cyan/20 hover:text-arcade-fg" onClick={() => resolve(c === brick.word.french, `Tu as choisi « ${c} »`)}>{c}</Button>)}
        </div>
      ) : brick && level === 2 && !keyboard && canRecognize() ? (
        <div className="space-y-2 text-center">
          <p className="text-sm opacity-80">Dis le mot allemand avec son article. La brique s'arrête pendant que tu parles.</p>
          <Button size="lg" onClick={speak} disabled={listening}>{listening ? "● J'écoute…" : "🎙️ Parler"}</Button>
          {(heard || hint) && <p className="text-sm">{hint || `J'entends : ${heard}`}</p>}
          <button className="block w-full text-xs underline" onClick={() => setKeyboard(true)}>⌨️ Passer au clavier</button>
        </div>
      ) : brick ? (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); submitTyped(); }}>
          <div className="flex gap-2">
            <input ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="ex. der Hund" autoCapitalize="off" autoCorrect="off" spellCheck={false}
              className="min-w-0 flex-1 rounded-md border border-neon-cyan/50 bg-arcade px-3 py-2 text-lg text-arcade-fg" />
            <Button type="submit">OK</Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {SPECIAL.map((c) => <Button key={c} type="button" size="sm" variant="secondary" onClick={() => { setTyped((t) => t + c); inputRef.current?.focus(); }}>{c}</Button>)}
          </div>
        </form>
      ) : null}
    </div>
  );
}
