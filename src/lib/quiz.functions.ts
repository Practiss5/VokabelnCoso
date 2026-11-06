import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { quizPoints, quizCorrect, type QuizQuestion } from "@/lib/quiz";

export const answerQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ session: z.uuid(), q_idx: z.number().int().min(0), given: z.string().max(300) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: s }, { data: me }] = await Promise.all([
      supabaseAdmin.from("quiz_sessions").select("class_id,status,q_idx,q_started_at,questions").eq("id", data.session).maybeSingle(),
      supabaseAdmin.from("profiles").select("class_id").eq("id", context.userId).maybeSingle(),
    ]);
    if (!s || !me || s.class_id !== me.class_id) return { error: "Quiz indisponible." };
    if (s.status !== "question" || s.q_idx !== data.q_idx || !s.q_started_at) return { error: "Trop tard !" };
    const q = (s.questions as QuizQuestion[])[s.q_idx];
    const ms = Date.now() - new Date(s.q_started_at).getTime();
    if (!q || ms > (q.seconds + 2) * 1000) return { error: "Temps écoulé !" };
    const correct = quizCorrect(q, data.given);
    const { error } = await supabaseAdmin.from("quiz_answers").insert({
      session_id: data.session, student_id: context.userId, q_idx: data.q_idx,
      given: data.given, correct, ms, points: quizPoints(correct, ms, q.seconds),
    });
    if (error) return { error: "Réponse déjà envoyée." };
    return { error: null };
  });
