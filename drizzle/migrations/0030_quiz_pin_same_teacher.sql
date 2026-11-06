CREATE OR REPLACE FUNCTION public.quiz_join_pin(_pin text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'student') THEN RETURN false; END IF;
  -- PIN only opens quizzes run by the teacher of the student's own class.
  SELECT qs.id INTO sid FROM public.quiz_sessions qs
   JOIN public.classes mine ON mine.id = public.my_class_id()
   WHERE qs.pin = _pin AND qs.teacher_id = mine.teacher_id
     AND qs.status <> 'ended' AND qs.created_at > now() - interval '3 hours'
   ORDER BY qs.created_at DESC LIMIT 1;
  IF sid IS NULL THEN RETURN false; END IF;
  INSERT INTO public.quiz_joins(session_id, student_id) VALUES (sid, auth.uid()) ON CONFLICT DO NOTHING;
  RETURN true;
END $$;