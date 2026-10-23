ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_mode_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_mode_check CHECK (mode IN ('flashcard','choice','speaking','typing','context'));
ALTER TABLE public.skill_progress DROP CONSTRAINT IF EXISTS skill_progress_skill_check;
ALTER TABLE public.skill_progress ADD CONSTRAINT skill_progress_skill_check CHECK (skill IN ('recognition','translation','speaking','writing','context'));
DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.record_answer(uuid,text,boolean,text,text)'::regprocedure);
  IF position('''speaking''' in d) = 0 THEN
    d := replace(d, 'when ''context'' then ''context'' end', 'when ''context'' then ''context'' when ''speaking'' then ''speaking'' end');
    EXECUTE d;
  END IF;
END $$;