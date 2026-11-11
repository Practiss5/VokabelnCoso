import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { answerSchema, validateAnswer } from "@/lib/answer-validation";

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
    // Homework the student clicked: must be one of their class's homeworks on this word's list.
    if (data._homework) {
      const { data: hw } = await context.supabase.from("homeworks").select("id,list_id,word_ids").eq("id", data._homework).maybeSingle();
      if (!hw || hw.list_id !== word.list_id || (hw.word_ids?.length && !hw.word_ids.includes(word.id))) return { error: { message: "Devoir indisponible." } };
    }
    const result = validateAnswer(word, data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: saveError } = await supabaseAdmin.rpc("record_verified_answer", {
      _student: context.userId, _word: word.id, _mode: data._mode,
      _correct: result.correct, _given: result.given,
      ...(result.error ? { _error: result.error } : {}),
    });
    if (saveError) return { error: { message: "Réponse non enregistrée. Réessaie." } };
    if (data._homework) {
      // Tag the answer just saved so it counts only for this homework (even after its deadline).
      const { data: last } = await supabaseAdmin.from("reviews").select("id").eq("student_id", context.userId).eq("word_id", word.id)
        .is("homework_id", null).gte("created_at", new Date(Date.now() - 60000).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last) await supabaseAdmin.from("reviews").update({ homework_id: data._homework }).eq("id", last.id);
    }
    return { error: null };
  });