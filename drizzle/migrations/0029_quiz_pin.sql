ALTER TABLE public.quiz_sessions ADD COLUMN pin text NOT NULL DEFAULT lpad((floor(random()*1000000))::int::text, 6, '0');

CREATE TABLE public.quiz_joins (
  session_id uuid NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, student_id)
);
GRANT ALL ON public.quiz_joins TO service_role;
ALTER TABLE public.quiz_joins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.quiz_join_pin(_pin text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'student') THEN RETURN false; END IF;
  SELECT id INTO sid FROM public.quiz_sessions
   WHERE pin = _pin AND status <> 'ended' AND created_at > now() - interval '3 hours'
   ORDER BY created_at DESC LIMIT 1;
  IF sid IS NULL THEN RETURN false; END IF;
  INSERT INTO public.quiz_joins(session_id, student_id) VALUES (sid, auth.uid()) ON CONFLICT DO NOTHING;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.quiz_join_pin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.quiz_join_pin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.quiz_for_me() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.quiz_sessions; q jsonb; mine public.quiz_answers; total int;
BEGIN
  SELECT * INTO s FROM public.quiz_sessions qs
   WHERE (qs.class_id = public.my_class_id()
          OR EXISTS (SELECT 1 FROM public.quiz_joins j WHERE j.session_id = qs.id AND j.student_id = auth.uid()))
     AND qs.status <> 'ended' AND qs.created_at > now() - interval '3 hours'
   ORDER BY qs.created_at DESC LIMIT 1;
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