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
    // The service-only RPC validates the homework and writes its tag atomically.
    // Words outside its selection still count for personal progress, without a tag.
    const result = validateAnswer(word, data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: saveError } = await supabaseAdmin.rpc("record_verified_answer", {
      _student: context.userId, _word: word.id, _mode: data._mode,
      _correct: result.correct, _given: result.given,
      ...(result.error ? { _error: result.error } : {}),
      ...(data._homework ? { _homework: data._homework } : {}),
    });
    if (saveError) return { error: { message: "Réponse non enregistrée. Réessaie." } };
    return { error: null };
  });