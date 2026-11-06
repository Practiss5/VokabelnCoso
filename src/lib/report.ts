import { homeworkStatus, type HwRequirements } from "@/lib/vocab";

export type ReportHw = { id: string; created_at: string; due_at: string; list_id: string; word_ids: string[] | null; requirements: HwRequirements | null };
export type ReportReview = { word_id: string; created_at: string; mode: string; correct: boolean; homework_id?: string | null };

/** Parent report for one student: homework done (by the deadline), success rate over all answers, homework time. */
export function studentReport(hws: ReportHw[], listWords: Map<string, string[]>, reviews: ReportReview[], timeByHw: Map<string, number>, now = Date.now()) {
  const totalSeconds = hws.reduce((s, h) => s + (timeByHw.get(h.id) ?? 0), 0);
  const timed = hws.filter((h) => (timeByHw.get(h.id) ?? 0) > 0);
  const rows = hws.map((h) => {
    const st = homeworkStatus(h.word_ids ?? listWords.get(h.list_id) ?? [], reviews, h.created_at, h.due_at, h.requirements, h.id);
    return { id: h.id, due_at: h.due_at, done: st.done, late: st.late, overdue: new Date(h.due_at).getTime() < now, seconds: timeByHw.get(h.id) ?? 0 };
  });
  const correct = reviews.filter((r) => r.correct).length;
  return {
    totalSeconds,
    avgSeconds: timed.length ? Math.round(totalSeconds / timed.length) : 0,
    rate: reviews.length ? Math.round((correct / reviews.length) * 100) : null,
    answers: reviews.length,
    done: rows.filter((r) => r.done).length,
    count: hws.length,
    rows,
  };
}
