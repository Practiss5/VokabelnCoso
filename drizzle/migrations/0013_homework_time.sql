CREATE TABLE public.homework_time (
  homework_id uuid NOT NULL REFERENCES public.homeworks(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  seconds integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (homework_id, student_id)
);
GRANT SELECT ON public.homework_time TO authenticated;
GRANT ALL ON public.homework_time TO service_role;
ALTER TABLE public.homework_time ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher reads class homework time" ON public.homework_time FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.homeworks h WHERE h.id = homework_id AND h.teacher_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.add_homework_time(_hw uuid, _seconds integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR _seconds IS NULL OR _seconds <= 0 THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM homeworks WHERE id = _hw AND class_id = my_class_id()) THEN RETURN; END IF;
  INSERT INTO homework_time (homework_id, student_id, seconds)
  VALUES (_hw, auth.uid(), LEAST(_seconds, 120))
  ON CONFLICT (homework_id, student_id)
  DO UPDATE SET seconds = homework_time.seconds + LEAST(_seconds, 120), updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.add_homework_time(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_homework_time(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_homework_time_on_class() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;
DROP FUNCTION public.purge_homework_time_on_class();