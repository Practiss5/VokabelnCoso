CREATE TABLE public.quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  list_id uuid NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
  format text NOT NULL DEFAULT 'collective' CHECK (format IN ('collective','top3')),
  questions jsonb NOT NULL,
  q_idx integer NOT NULL DEFAULT -1,
  status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby','question','reveal','ended')),
  q_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_sessions TO authenticated;
GRANT ALL ON public.quiz_sessions TO service_role;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher owns quiz" ON public.quiz_sessions FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(),'teacher')
    AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.teacher_id = auth.uid()));

CREATE TABLE public.quiz_answers (
  session_id uuid NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  q_idx integer NOT NULL,
  given text NOT NULL DEFAULT '',
  correct boolean NOT NULL,
  ms integer NOT NULL,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, student_id, q_idx)
);
GRANT SELECT ON public.quiz_answers TO authenticated;
GRANT ALL ON public.quiz_answers TO service_role;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher reads quiz answers" ON public.quiz_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_sessions s WHERE s.id = session_id AND s.teacher_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.quiz_for_me() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.quiz_sessions; q jsonb; mine public.quiz_answers; total int;
BEGIN
  SELECT * INTO s FROM public.quiz_sessions
   WHERE class_id = public.my_class_id() AND status <> 'ended' AND created_at > now() - interval '3 hours'
   ORDER BY created_at DESC LIMIT 1;
  IF s.id IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(sum(points),0) INTO total FROM public.quiz_answers WHERE session_id = s.id AND student_id = auth.uid();
  IF s.q_idx >= 0 THEN
    q := s.questions -> s.q_idx;
    SELECT * INTO mine FROM public.quiz_answers WHERE session_id = s.id AND student_id = auth.uid() AND q_idx = s.q_idx;
  END IF;
  RETURN jsonb_build_object(
    'id', s.id, 'status', s.status, 'format', s.format, 'q_idx', s.q_idx,
    'total', jsonb_array_length(s.questions), 'started_at', s.q_started_at, 'points', total,
    'question', CASE WHEN q IS NULL THEN NULL ELSE jsonb_build_object(
      'mode', q->>'mode', 'prompt', CASE WHEN q->>'mode' = 'audio' THEN NULL ELSE q->>'prompt' END,
      'options', q->'options', 'seconds', q->'seconds',
      'answer', CASE WHEN s.status = 'reveal' THEN q->>'answer' END) END,
    'mine', CASE WHEN mine.session_id IS NULL THEN NULL ELSE jsonb_build_object('correct', mine.correct, 'given', mine.given) END);
END $$;
REVOKE ALL ON FUNCTION public.quiz_for_me() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.quiz_for_me() TO authenticated;