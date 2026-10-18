CREATE TABLE public.skill_progress (
  student_id uuid NOT NULL,
  word_id uuid NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  skill text NOT NULL CHECK (skill IN ('recognition','translation','writing','context')),
  step integer NOT NULL DEFAULT 0,
  due_at timestamptz NOT NULL DEFAULT now(),
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  last_error text,
  PRIMARY KEY (student_id, word_id, skill)
);
GRANT SELECT ON public.skill_progress TO authenticated;
GRANT ALL ON public.skill_progress TO service_role;
ALTER TABLE public.skill_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student reads own skills" ON public.skill_progress FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "teacher reads class skills" ON public.skill_progress FOR SELECT TO authenticated USING (public.is_teacher_of_student(student_id));

ALTER TABLE public.reviews ADD COLUMN skill text, ADD COLUMN error_type text, ADD COLUMN given_answer text;

-- Backfill skills from existing history
INSERT INTO public.skill_progress (student_id, word_id, skill, step, due_at, correct_count, wrong_count, last_reviewed_at)
SELECT r.student_id, r.word_id,
  CASE r.mode WHEN 'flashcard' THEN 'recognition' WHEN 'choice' THEN 'translation' ELSE 'writing' END,
  0, now(), count(*) FILTER (WHERE r.correct), count(*) FILTER (WHERE NOT r.correct), max(r.created_at)
FROM public.reviews r GROUP BY 1,2,3
ON CONFLICT DO NOTHING;
UPDATE public.reviews SET skill = CASE mode WHEN 'flashcard' THEN 'recognition' WHEN 'choice' THEN 'translation' ELSE 'writing' END WHERE skill IS NULL;

DROP FUNCTION IF EXISTS public.record_answer(uuid, text, boolean);

-- Intervals ladder (days) per step: 0=>10 min, 1=>1, 2=>3, 3=>7, 4=>14, 5=>30, 6+=>60
CREATE OR REPLACE FUNCTION public.step_interval(_step integer)
RETURNS interval LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _step <= 0 THEN interval '10 minutes'
    WHEN _step = 1 THEN interval '1 day'
    WHEN _step = 2 THEN interval '3 days'
    WHEN _step = 3 THEN interval '7 days'
    WHEN _step = 4 THEN interval '14 days'
    WHEN _step = 5 THEN interval '30 days'
    ELSE interval '60 days' END
$$;

CREATE OR REPLACE FUNCTION public.record_answer(_word uuid, _mode text, _correct boolean, _given text DEFAULT NULL, _error text DEFAULT NULL)
RETURNS public.skill_progress
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  _list uuid; _skill text; s public.skill_progress; p public.word_progress;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select list_id into _list from public.words where id = _word;
  if _list is null or not public.student_can_access_list(_list) then raise exception 'Accès refusé'; end if;
  _skill := case _mode when 'flashcard' then 'recognition' when 'choice' then 'translation' when 'typing' then 'writing' when 'context' then 'context' end;
  if _skill is null then raise exception 'Mode invalide'; end if;
  if _correct then _error := null;
  elsif _error is not null and _error not in ('article','spelling','translation','context','unknown') then _error := 'unknown'; end if;

  insert into public.reviews (student_id, word_id, mode, correct, skill, error_type, given_answer)
  values (auth.uid(), _word, _mode, _correct, _skill, _error, left(_given, 200));

  insert into public.skill_progress (student_id, word_id, skill) values (auth.uid(), _word, _skill) on conflict do nothing;
  select * into s from public.skill_progress where student_id = auth.uid() and word_id = _word and skill = _skill for update;
  if _correct then
    s.step := s.step + 1; s.streak := s.streak + 1; s.correct_count := s.correct_count + 1;
  else
    s.step := 0; s.streak := 0; s.wrong_count := s.wrong_count + 1; s.last_error := _error;
  end if;
  s.due_at := now() + public.step_interval(s.step);
  s.last_reviewed_at := now();
  update public.skill_progress set step = s.step, streak = s.streak, correct_count = s.correct_count,
    wrong_count = s.wrong_count, last_error = s.last_error, due_at = s.due_at, last_reviewed_at = s.last_reviewed_at
  where student_id = auth.uid() and word_id = _word and skill = _skill;

  -- Global summary: word is due as soon as its weakest practised skill is due.
  insert into public.word_progress (student_id, word_id) values (auth.uid(), _word) on conflict do nothing;
  update public.word_progress wp set
    correct_count = wp.correct_count + (case when _correct then 1 else 0 end),
    wrong_count = wp.wrong_count + (case when _correct then 0 else 1 end),
    repetitions = (select coalesce(min(step),0) from public.skill_progress where student_id = auth.uid() and word_id = _word),
    interval_days = 0,
    due_at = (select min(due_at) from public.skill_progress where student_id = auth.uid() and word_id = _word),
    last_reviewed_at = now()
  where wp.student_id = auth.uid() and wp.word_id = _word;
  return s;
end $$;
REVOKE EXECUTE ON FUNCTION public.record_answer(uuid, text, boolean, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_answer(uuid, text, boolean, text, text) TO authenticated;