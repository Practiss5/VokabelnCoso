import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DAILY_GOAL, nextHomeworkMode, computeStreak, dueCountdown, homeworkCsv, homeworkStatus, HW_MODES, HW_RATES, type HwMode, type HwRequirements } from "@/lib/vocab";
import { formatDuration } from "@/lib/study-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fmt = (d: string) => new Date(d).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
/** Copy of a homework for another class: same list, words, instructions and thresholds, untouched. */
export const dupPayload = (h: { list_id: string; instructions: string; word_ids: string[] | null; requirements: HwRequirements | null }, teacherId: string, classId: string, dueIso: string) =>
  ({ teacher_id: teacherId, class_id: classId, list_id: h.list_id, due_at: dueIso, instructions: h.instructions, word_ids: h.word_ids, requirements: h.requirements });
const toLocalInput = (d: string) => { const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

type Hw = {
  id: string; list_id: string; due_at: string; instructions: string; created_at: string;
  word_ids: string[] | null; requirements: HwRequirements | null;
  vocab_lists: { title: string; words: { id: string }[] } | null;
};
const HW_SELECT = "id, list_id, due_at, instructions, created_at, word_ids, requirements, vocab_lists(title, words(id))";
/** Words of the homework: the selected ones (still in the list), or the whole list. */
const hwWords = (h: Hw) => {
  const all = h.vocab_lists?.words.map((w) => w.id) ?? [];
  return h.word_ids?.length ? all.filter((id) => h.word_ids!.includes(id)) : all;
};
const partsText = (parts: ReturnType<typeof homeworkStatus>["parts"]) =>
  parts.map((p) => `${p.label} ${p.got}/${p.need} ${p.got >= p.need ? "✅" : "⏳"}`).join(" · ");

/** Teacher: give homework to a class and see who did it. */
export function TeacherHomework({ classId, students }: { classId: string; students: { id: string; full_name: string }[] }) {
  const qc = useQueryClient();
  const [listId, setListId] = useState("");
  const [due, setDue] = useState("");
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [req, setReq] = useState<HwRequirements>({ choice: 0.7, typing: 0.7 });
  const [dup, setDup] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["homeworks", classId],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const [hw, lists, classes] = await Promise.all([
        supabase.from("homeworks").select(HW_SELECT).eq("class_id", classId).order("due_at", { ascending: false }),
        supabase.from("vocab_lists").select("id, title").eq("teacher_id", u.user!.id).order("title"),
        supabase.from("classes").select("id, name").eq("teacher_id", u.user!.id).order("name"),
      ]);
      const ids = students.map((s) => s.id);
      const oldest = (hw.data ?? []).reduce<string | null>((m, h) => { const c = (h as { created_at: string }).created_at; return !m || c < m ? c : m; }, null);
      const rev = ids.length && oldest ? await fetchAllReviews((from, to) => supabase.from("reviews").select("student_id, word_id, created_at, mode, correct").in("student_id", ids).gte("created_at", oldest).order("created_at").order("id").range(from, to)) : [];
      const hwIds = (hw.data ?? []).map((h) => (h as { id: string }).id);
      const times = hwIds.length ? (await supabase.from("homework_time").select("homework_id, student_id, seconds").in("homework_id", hwIds)).data ?? [] : [];
      const time = new Map(times.map((t) => [`${t.homework_id}:${t.student_id}`, t.seconds]));
      return { hw: (hw.data ?? []) as unknown as Hw[], lists: lists.data ?? [], classes: classes.data ?? [], rev, time };
    },
  });
  const { data: listWords } = useQuery({
    queryKey: ["hw-list-words", listId],
    enabled: !!listId,
    queryFn: async () => (await supabase.from("words").select("id, german, french").eq("list_id", listId).order("created_at")).data ?? [],
  });

  function chooseList(id: string) {
    setListId(id);
    setPicked(new Set());
    if (id) void supabase.from("words").select("id").eq("list_id", id).then(({ data: w }) => setPicked(new Set((w ?? []).map((x) => x.id))));
  }
  function toggleWord(id: string) {
    setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleMode(m: HwMode) {
    setReq((r) => { const n = { ...r }; if (n[m] != null) delete n[m]; else n[m] = 0.7; return n; });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!picked.size) { toast.error("Choisis au moins un mot."); return; }
    if (!Object.keys(req).length) { toast.error("Choisis au moins un exercice."); return; }
    const { data: u } = await supabase.auth.getUser();
    // Make sure the class can open the list.
    await supabase.from("list_assignments").upsert({ list_id: listId, class_id: classId }, { onConflict: "list_id,class_id", ignoreDuplicates: true });
    const allPicked = listWords && picked.size === listWords.length;
    const { error } = await supabase.from("homeworks").insert({
      teacher_id: u.user!.id, class_id: classId, list_id: listId, due_at: new Date(due).toISOString(), instructions: text.trim(),
      word_ids: allPicked ? null : [...picked], requirements: req,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Devoir donné à la classe");
    setText(""); setDue(""); setListId(""); setPicked(new Set());
    qc.invalidateQueries({ queryKey: ["homeworks", classId] });
    qc.invalidateQueries({ queryKey: ["class", classId] });
  }
  async function duplicate(h: Hw, f: FormData) {
    const cls = String(f.get("cls") ?? ""), dueStr = String(f.get("due") ?? "");
    if (!cls || !dueStr) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("list_assignments").upsert({ list_id: h.list_id, class_id: cls }, { onConflict: "list_id,class_id", ignoreDuplicates: true });
    const { error } = await supabase.from("homeworks").insert(dupPayload(h, u.user!.id, cls, new Date(dueStr).toISOString()));
    if (error) { toast.error(error.message); return; }
    toast.success(`Devoir dupliqué vers ${data?.classes.find((c) => c.id === cls)?.name ?? "la classe"}`);
    setDup(null);
    qc.invalidateQueries({ queryKey: ["homeworks", cls] });
  }
  async function remove(id: string) {
    if (!confirm("Supprimer ce devoir ?")) return;
    await supabase.from("homeworks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["homeworks", classId] });
  }

  function exportCsv(title: string, dueAt: string, st: { s: { full_name: string }; r: ReturnType<typeof homeworkStatus>; seconds: number }[]) {
    const due = new Date(dueAt).toLocaleDateString("fr-FR");
    const csv = homeworkCsv(title, due, new Date(dueAt).getTime() < Date.now(), st.map(({ s, r, seconds }) => ({ name: s.full_name || "—", done: r.done, total: r.total, parts: r.parts, seconds })));
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `devoir-${title.replace(/[^\p{L}\p{N}]+/gu, "-")}-${due.replace(/\//g, "-")}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  return (
    <section className="word-card space-y-4 p-4">
      <h2 className="text-xl font-bold">📅 Devoirs</h2>
      <form onSubmit={create} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Liste à réviser
            <select required value={listId} onChange={(e) => chooseList(e.target.value)} className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3">
              <option value="">Choisir…</option>
              {data?.lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </label>
          <label className="text-sm">À faire pour le
            <Input required type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1" />
          </label>
          <label className="text-sm sm:col-span-2">Consigne (facultatif)
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. : apprendre les mots de la page 12" className="mt-1" />
          </label>
        </div>

        {listId && listWords && (
          <fieldset className="rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">Mots du devoir : {picked.size} sur {listWords.length}</legend>
            <div className="mb-2 flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setPicked(new Set(listWords.map((w) => w.id)))}>Tout cocher</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPicked(new Set())}>Tout décocher</Button>
            </div>
            <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
              {listWords.map((w) => (
                <label key={w.id} className="flex cursor-pointer items-center gap-2 rounded bg-secondary px-2 py-1 text-sm">
                  <input type="checkbox" checked={picked.has(w.id)} onChange={() => toggleWord(w.id)} className="h-4 w-4" />
                  <span><b>{w.german}</b> — {w.french}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="rounded-lg border p-3">
          <legend className="px-1 text-sm font-semibold">Exercices demandés et seuil de réussite</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {HW_MODES.map((m) => {
              const on = req[m.id] != null;
              return (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded bg-secondary px-2 py-1.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={on} onChange={() => toggleMode(m.id)} className="h-4 w-4" />
                    {m.label}
                  </label>
                  <select aria-label={`Seuil ${m.label}`} disabled={!on} value={req[m.id] ?? 0.7}
                    onChange={(e) => setReq((r) => ({ ...r, [m.id]: Number(e.target.value) }))}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-40">
                    {HW_RATES.map((v) => <option key={v} value={v}>{Math.round(v * 100)} %</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Le devoir est « fait » quand, avant la date limite, l'élève a réussi le pourcentage demandé des mots dans chaque exercice coché.</p>
        </fieldset>
        <Button type="submit">Donner en devoir</Button>
      </form>
      {data?.hw.map((h) => {
        const words = hwWords(h);
        const st = students.map((s) => ({ s, r: homeworkStatus(words, data.rev.filter((x) => x.student_id === s.id), h.created_at, h.due_at, h.requirements) }));
        const doneN = st.filter((x) => x.r.done).length;
        const late = new Date(h.due_at).getTime() < Date.now();
        const rule = st[0]?.r.parts ?? homeworkStatus(words, [], h.created_at, h.due_at, h.requirements).parts;
        const secs = (id: string) => data.time.get(`${h.id}:${id}`) ?? 0;
        const timed = students.map((s) => secs(s.id)).filter((x) => x > 0);
        const avg = timed.length ? timed.reduce((a, b) => a + b, 0) / timed.length : 0;
        return (
          <div key={h.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold">{h.vocab_lists?.title} <span className="text-sm font-normal text-muted-foreground">· {words.length} mot{words.length > 1 ? "s" : ""}</span></p>
                <p className="text-sm text-muted-foreground">Pour {fmt(h.due_at)}{late ? " · terminé" : ""}{h.instructions ? ` · ${h.instructions}` : ""}</p>
                <p className="text-xs text-muted-foreground">{rule.map((p) => `${p.label} ${Math.round(p.rate * 100)} %`).join(" · ")}</p>
                <p className="text-sm font-semibold">{doneN}/{students.length} élèves ont fait le devoir{avg ? ` · Temps moyen : ${formatDuration(avg)}` : ""}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={() => exportCsv(h.vocab_lists?.title ?? "devoir", h.due_at, st.map((x) => ({ ...x, seconds: secs(x.s.id) })))}>⬇️ Excel / CSV</Button>
                <Button size="sm" variant="outline" onClick={() => { setDup(dup === h.id ? null : h.id); }}>📋 Dupliquer</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(h.id)}>Supprimer</Button>
              </div>
              {dup === h.id && (
                <form onSubmit={(e) => { e.preventDefault(); void duplicate(h, new FormData(e.currentTarget)); }} className="flex w-full flex-wrap items-end gap-2 rounded-md bg-secondary p-2 text-sm">
                  <label>Vers la classe
                    <select name="cls" required className="mt-1 block h-9 rounded-md border border-input bg-background px-2">
                      <option value="">Choisir…</option>
                      {data.classes.filter((c) => c.id !== classId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label>Date limite
                    <Input name="due" type="datetime-local" required defaultValue={toLocalInput(h.due_at)} className="mt-1 h-9" />
                  </label>
                  <p className="w-full text-xs text-muted-foreground">Seuils copiés à l'identique : {homeworkStatus(hwWords(h), [], h.created_at, h.due_at, h.requirements).parts.map((p) => `${p.label} ${Math.round(p.rate * 100)} %`).join(" · ")}</p>
                  <Button size="sm" type="submit">Dupliquer</Button>
                  {data.classes.length < 2 && <p className="w-full text-xs text-muted-foreground">Tu n'as pas d'autre classe pour l'instant.</p>}
                </form>
              )}
            </div>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {st.map(({ s, r }) => (
                <li key={s.id} className="flex justify-between gap-2 rounded bg-secondary px-2 py-1">
                  <span>{s.full_name || "—"}</span>
                  <span className={r.done ? "font-semibold text-success" : "text-right text-muted-foreground"}>{r.done ? "Fait ✅" : `${late ? "Non fait" : "À faire"} · ${partsText(r.parts)}`} · ⏱️ {formatDuration(secs(s.id))}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {data && data.hw.length === 0 && <p className="text-sm text-muted-foreground">Aucun devoir pour l'instant.</p>}
    </section>
  );
}

/** Student: upcoming homework shown at the top of the home page. */
export function StudentHomework({ studentId, classId }: { studentId: string; classId: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const { data } = useQuery({
    queryKey: ["my-homeworks", classId],
    queryFn: async () => {
      const since = new Date(Date.now() - 2 * 86400000).toISOString();
      const hw = ((await supabase.from("homeworks").select(HW_SELECT).eq("class_id", classId).gte("due_at", since).order("due_at")).data ?? []) as unknown as Hw[];
      const oldest = hw.reduce<string | null>((m, h) => (!m || h.created_at < m ? h.created_at : m), null);
      const rev = oldest ? await fetchAllReviews((from, to) => supabase.from("reviews").select("word_id, created_at, mode, correct").eq("student_id", studentId).gte("created_at", oldest).order("created_at").order("id").range(from, to)) : [];
      return hw.map((h) => {
        const ws = new Set(hwWords(h));
        // Any answer (even wrong) on a homework word since assignment means the homework is started.
        const started = rev.some((x) => ws.has(x.word_id) && x.created_at >= h.created_at);
        return { h, started, r: homeworkStatus(hwWords(h), rev, h.created_at, h.due_at, h.requirements) };
      });
    },
  });
  if (!data?.length) return null;
  // `now` ticks every 30 s (see hook above) so the countdown stays live.
  return (
    <section className="space-y-3">
      {data.map(({ h, r, started }) => {
        const late = new Date(h.due_at).getTime() < Date.now();
        const cd = dueCountdown(h.due_at, now);
        const badge = { late: "bg-destructive text-destructive-foreground", urgent: "bg-destructive text-destructive-foreground animate-pulse", soon: "bg-accent text-accent-foreground", ok: "bg-secondary text-secondary-foreground" }[cd.level];
        return (
          <div key={h.id} className={`word-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between ${r.done ? "border-success" : cd.level === "urgent" || cd.level === "late" ? "border-destructive" : "border-accent"} border-2`}>
            <div>
              <span className={`mb-2 inline-block rounded-full px-3 py-1 text-sm font-bold ${r.done ? "bg-success text-success-foreground" : badge}`}>{r.done && cd.level !== "late" ? `✅ Fait · ${cd.label.replace(/^\S+\s/, "")}` : cd.label}</span>
              <p className="text-sm font-semibold">{r.done ? "✅ Devoir validé, bravo !" : late ? "⌛ Devoir en retard" : `📌 Devoir à faire pour ${fmt(h.due_at)}`}</p>
              <p className="text-xl font-bold">{h.vocab_lists?.title} <span className="text-sm font-normal">· {r.total} mot{r.total > 1 ? "s" : ""}</span></p>
              {h.instructions && <p className="text-sm">{h.instructions}</p>}
              {!r.done && <p className="text-sm text-muted-foreground">{r.parts.map((p) => `${p.label} : ${p.got}/${p.need} mots (${Math.round(p.rate * 100)} %) ${p.got >= p.need ? "✅" : "⏳"}`).join(" · ")}</p>}
            </div>
            {!r.done && <Button asChild size="lg"><Link to="/eleve/reviser/$listId" params={{ listId: h.list_id }} search={{ devoir: h.id, ...(nextHomeworkMode(r.parts) ? { exo: nextHomeworkMode(r.parts) as "choice" } : {}) }}>{started || r.parts.some((p) => p.got > 0) ? "Continuer mon devoir" : "Commencer le devoir"}</Link></Button>}
          </div>
        );
      })}
    </section>
  );
}

/** Student: daily streak ("série") with a flame. */
export function StudentStreak({ studentId }: { studentId: string }) {
  const { data } = useQuery({
    queryKey: ["streak", studentId],
    queryFn: async () => {
      const since = new Date(Date.now() - 400 * 86400000).toISOString();
      const [rv, mg] = await Promise.all([
        supabase.from("reviews").select("created_at").eq("student_id", studentId).gte("created_at", since).limit(20000),
        supabase.from("match_games").select("created_at, pairs").eq("student_id", studentId).gte("created_at", since).limit(5000),
      ]);
      // Each matched pair in the game counts as one answer toward the daily flame.
      const dates = (rv.data ?? []).map((x) => x.created_at);
      for (const g of mg.data ?? []) for (let i = 0; i < g.pairs; i++) dates.push(g.created_at);
      return computeStreak(dates, new Date());
    },
  });
  if (!data) return null;
  const msg = data.days === 0 ? `Fais tes ${DAILY_GOAL} mots aujourd'hui pour allumer ta flamme !` : data.today ? "Objectif du jour atteint. Reviens demain pour entretenir ta flamme !" : `Fais tes ${DAILY_GOAL} mots aujourd'hui pour garder ta série !`;
  return (
    <section className="word-card flex items-center gap-4 border-2 border-accent p-4">
      <span aria-hidden className={`text-4xl ${data.days ? "" : "opacity-30 grayscale"}`}>🔥</span>
      <div>
        <p className="text-xl font-bold">Série : {data.days} jour{data.days > 1 ? "s" : ""}</p>
        <p className="text-sm text-muted-foreground">{msg}</p>
      </div>
    </section>
  );
}
