CREATE OR REPLACE FUNCTION public.class_match_top(_list uuid)
 RETURNS TABLE(full_name text, best_run integer, is_me boolean, outfit jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select coalesce(nullif(p.full_name,''),'Élève'), max(g.best_run)::int, g.student_id = auth.uid(), p.outfit
  from public.match_games g join public.profiles p on p.id = g.student_id
  where g.class_id = public.my_class_id() and g.list_id = _list and public.my_class_id() is not null
    and public.student_can_access_list(_list)
  group by g.student_id, p.full_name, p.outfit order by 2 desc limit 5
$function$;

CREATE OR REPLACE FUNCTION public.my_duels()
 RETURNS TABLE(duel_id uuid, list_title text, created_at timestamp with time zone, expires_at timestamp with time zone, opponent text, opp_outfit jsonb, my_outfit jsonb, my_idx integer, total integer, my_score integer, my_ms integer, my_finished boolean, opp_finished boolean, opp_score integer, opp_ms integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select d.id, l.title, d.created_at, d.expires_at, coalesce(nullif(op.full_name, ''), 'Un camarade'),
    op.outfit, mp.outfit,
    me.idx, array_length(d.word_ids, 1), me.score, me.total_ms, me.finished,
    o.finished,
    case when me.finished and o.finished then o.score end,
    case when me.finished and o.finished then o.total_ms end
  from public.duel_players me
  join public.duels d on d.id = me.duel_id
  join public.duel_players o on o.duel_id = d.id and o.student_id <> me.student_id
  left join public.profiles op on op.id = o.student_id
  left join public.profiles mp on mp.id = me.student_id
  join public.vocab_lists l on l.id = d.list_id
  where me.student_id = auth.uid() and d.created_at > now() - interval '14 days'
    and d.class_id = public.my_class_id()
  order by d.created_at desc limit 20
$function$;

CREATE OR REPLACE FUNCTION public.quiz_for_me()
 RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s public.quiz_sessions; q jsonb; mine public.quiz_answers; total int;
BEGIN
  IF public.my_class_id() IS NULL THEN RETURN NULL; END IF;
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
END $function$;