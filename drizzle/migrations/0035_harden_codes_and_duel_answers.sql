CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.generate_student_codes(_class uuid, _count integer)
 RETURNS SETOF student_codes LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _i int; _code text; _b int; _alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if not exists (select 1 from public.classes where id = _class and teacher_id = auth.uid()) then
    raise exception 'Réservé à l''enseignant de la classe';
  end if;
  if _count < 1 or _count > 60 then raise exception 'Nombre invalide (1 à 60)'; end if;
  for _i in 1.._count loop
    loop
      _code := '';
      while length(_code) < 8 loop
        _b := get_byte(extensions.gen_random_bytes(1), 0);
        if _b < 248 then _code := _code || substr(_alphabet, (_b % 31) + 1, 1); end if;
      end loop;
      exit when not exists (select 1 from public.student_codes where code = _code);
    end loop;
    insert into public.student_codes (code, class_id) values (_code, _class);
  end loop;
  return query select * from public.student_codes where class_id = _class order by created_at desc limit _count;
end $function$;

CREATE OR REPLACE FUNCTION public.answer_duel(_duel uuid, _choice text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _p public.duel_players; _d public.duels; _w public.words; _ok boolean; _ms integer; _n integer;
BEGIN
  SELECT * INTO _p FROM public.duel_players WHERE duel_id = _duel AND student_id = _me FOR UPDATE;
  IF NOT FOUND OR _p.finished OR _p.q_started_at IS NULL THEN RAISE EXCEPTION 'Question non disponible'; END IF;
  SELECT * INTO _d FROM public.duels WHERE id = _duel;
  IF public.my_class_id() IS DISTINCT FROM _d.class_id THEN RAISE EXCEPTION 'Question non disponible'; END IF;
  IF _d.expires_at < now() THEN RAISE EXCEPTION 'Ce duel a expiré'; END IF;
  SELECT * INTO _w FROM public.words WHERE id = _d.word_ids[_p.idx + 1];
  _ok := _choice = _w.french;
  _ms := least(60000, (extract(epoch FROM now() - _p.q_started_at) * 1000)::integer);
  _n := array_length(_d.word_ids, 1);
  UPDATE public.duel_players SET idx = idx + 1, score = score + (CASE WHEN _ok THEN 1 ELSE 0 END),
    total_ms = total_ms + _ms, q_started_at = NULL, finished = (idx + 1 >= _n)
    WHERE duel_id = _duel AND student_id = _me;
  RETURN jsonb_build_object('correct', _ok, 'answer', _w.french);
END $function$;