DROP FUNCTION IF EXISTS public.record_verified_answer(uuid,uuid,text,boolean,text,text);
CREATE OR REPLACE FUNCTION public.record_verified_answer(_student uuid, _word uuid, _mode text, _correct boolean, _given text DEFAULT NULL, _error text DEFAULT NULL, _homework uuid DEFAULT NULL)
 RETURNS skill_progress LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  _list uuid; _skill text; s public.skill_progress;
begin
  if _student is null then raise exception 'Non connecté'; end if;
  select list_id into _list from public.words where id = _word;
  if _list is null or not exists (select 1 from public.profiles pr join public.list_assignments la on la.class_id=pr.class_id where pr.id=_student and la.list_id=_list) then raise exception 'Accès refusé'; end if;
  _skill := case _mode when 'flashcard' then 'recognition' when 'choice' then 'translation' when 'choice_de_fr' then 'translation' when 'choice_fr_de' then 'translation' when 'listen_de_fr' then 'translation' when 'listen_fr_de' then 'translation' when 'typing' then 'writing' when 'context' then 'context' when 'speaking' then 'speaking' end;
  if _skill is null then raise exception 'Mode invalide'; end if;
  if _correct then _error := null;
  elsif _error is not null and _error not in ('article','spelling','translation','context','unknown') then _error := 'unknown'; end if;
  if _homework is not null and not exists (select 1 from public.homeworks h join public.profiles pr on pr.class_id = h.class_id
      where h.id = _homework and pr.id = _student and h.list_id = _list and h.archived_at is null
        and (h.word_ids is null or cardinality(h.word_ids) = 0 or _word = any(h.word_ids))) then _homework := null; end if;
  insert into public.reviews (student_id, word_id, mode, correct, skill, error_type, given_answer, homework_id)
  values (_student, _word, _mode, _correct, _skill, _error, left(_given, 200), _homework);
  insert into public.skill_progress (student_id, word_id, skill) values (_student, _word, _skill) on conflict do nothing;
  select * into s from public.skill_progress where student_id = _student and word_id = _word and skill = _skill for update;
  if _correct then
    s.step := s.step + 1; s.streak := s.streak + 1; s.correct_count := s.correct_count + 1;
  else
    s.step := 0; s.streak := 0; s.wrong_count := s.wrong_count + 1; s.last_error := _error;
  end if;
  s.due_at := now() + public.step_interval(s.step);
  s.last_reviewed_at := now();
  update public.skill_progress set step = s.step, streak = s.streak, correct_count = s.correct_count,
    wrong_count = s.wrong_count, last_error = s.last_error, due_at = s.due_at, last_reviewed_at = s.last_reviewed_at
  where student_id = _student and word_id = _word and skill = _skill;
  insert into public.word_progress (student_id, word_id) values (_student, _word) on conflict do nothing;
  update public.word_progress wp set
    correct_count = wp.correct_count + (case when _correct then 1 else 0 end),
    wrong_count = wp.wrong_count + (case when _correct then 0 else 1 end),
    repetitions = (select coalesce(min(step),0) from public.skill_progress where student_id = _student and word_id = _word),
    interval_days = 0,
    due_at = (select min(due_at) from public.skill_progress where student_id = _student and word_id = _word),
    last_reviewed_at = now()
  where wp.student_id = _student and wp.word_id = _word;
  return s;
end $function$;
REVOKE ALL ON FUNCTION public.record_verified_answer(uuid,uuid,text,boolean,text,text,uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_answer(uuid,uuid,text,boolean,text,text,uuid) TO service_role;