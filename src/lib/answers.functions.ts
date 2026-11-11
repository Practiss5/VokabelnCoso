import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { answerSchema, validateAnswer } from "@/lib/answer-validation";
import { pickHomeworkForAnswer } from "@/lib/homework-tag";

export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => answerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "student" });
    if (!role) return { error: { message: "Accès refusé." } };
    const { data: word, error } = await context.supabase.from("words").select("id,list_id,german,french,example_de").eq("id", data._word).maybeSingle();
    if (error || !word) return { error: { message: "Mot indisponible." } };
    const { data: allowed } = await context.supabase.rpc("student_can_access_list", { _list: word.list_id });
    if (!allowed) return { error: { message: "Accès refusé." } };
    // Homeworks of the student's class on this list (RLS: own class only). The answer is never refused
    // because of a homework: it is saved, and tagged with at most one homework that contains the word.
    const { data: hws } = await context.supabase.from("homeworks").select("id,list_id,word_ids,due_at,archived_at").eq("list_id", word.list_id);
    const tag = pickHomeworkForAnswer(hws ?? [], word.id, data._homework, new Date());
    const result = validateAnswer(word, data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: saveError } = await supabaseAdmin.rpc("record_verified_answer", {
      _student: context.userId, _word: word.id, _mode: data._mode,
      _correct: result.correct, _given: result.given,
      ...(result.error ? { _error: result.error } : {}),
    });
    if (saveError) return { error: { message: "Réponse non enregistrée. Réessaie." } };
    if (tag) {
      // Tag the answer just saved (latest untagged one for this word, no time window to miss).
      const { data: last } = await supabaseAdmin.from("reviews").select("id").eq("student_id", context.userId).eq("word_id", word.id)
        .is("homework_id", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last) await supabaseAdmin.from("reviews").update({ homework_id: tag }).eq("id", last.id);
    }
    return { error: null };
  });
