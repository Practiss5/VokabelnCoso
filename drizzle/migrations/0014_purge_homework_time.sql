CREATE OR REPLACE FUNCTION public.purge_class_data(_class uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
begin
  if not exists (select 1 from public.classes where id = _class and teacher_id = auth.uid()) then
    raise exception 'Réservé à l''enseignant de la classe';
  end if;
  delete from public.reviews where student_id in (select id from public.profiles where class_id = _class);
  delete from public.skill_progress where student_id in (select id from public.profiles where class_id = _class);
  delete from public.word_progress where student_id in (select id from public.profiles where class_id = _class);
  delete from public.match_games where student_id in (select id from public.profiles where class_id = _class);
  delete from public.tetris_games where student_id in (select id from public.profiles where class_id = _class);
  delete from public.homework_time where student_id in (select id from public.profiles where class_id = _class);
  delete from public.student_codes where class_id = _class;
  update public.profiles set class_id = null where class_id = _class;
end $fn$;