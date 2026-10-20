import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildDailySession, DAILY_GOAL, type Word } from "@/lib/vocab";

/** Everything the daily session needs, built from the student's real results. */
export const dailyQuery = (studentId: string, classId: string) =>
  queryOptions({
    queryKey: ["daily", studentId],
    queryFn: async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [a, sk, today] = await Promise.all([
        supabase.from("list_assignments").select("vocab_lists(words(id, german, french, example_de, example_fr))").eq("class_id", classId),
        supabase.from("skill_progress").select("word_id, skill, step, due_at, wrong_count, correct_count, last_reviewed_at").eq("student_id", studentId),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("student_id", studentId).gte("created_at", startOfDay.toISOString()),
      ]);
      const seen = new Set<string>();
      const words: Word[] = [];
      for (const x of a.data ?? []) for (const w of x.vocab_lists?.words ?? []) if (!seen.has(w.id)) { seen.add(w.id); words.push(w); }
      const items = buildDailySession(words, sk.data ?? [], new Date(), DAILY_GOAL);
      return { words, items, doneToday: today.count ?? 0 };
    },
  });
