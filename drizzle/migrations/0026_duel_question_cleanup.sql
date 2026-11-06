CREATE OR REPLACE FUNCTION public.duel_question(_duel uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _p public.duel_players; _d public.duels; _w public.words; _choices text[];
BEGIN
  SELECT * INTO _p FROM public.duel_players WHERE duel_id = _duel AND student_id = _me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Duel introuvable'; END IF;
  SELECT * INTO _d FROM public.duels WHERE id = _duel;
  IF _p.finished OR _p.idx >= array_length(_d.word_ids, 1) THEN RETURN jsonb_build_object('done', true); END IF;
  IF _d.expires_at < now() THEN RAISE EXCEPTION 'Ce duel a expiré'; END IF;
  SELECT * INTO _w FROM public.words WHERE id = _d.word_ids[_p.idx + 1];
  SELECT array_agg(c ORDER BY random()) INTO _choices FROM (
    SELECT _w.french AS c
    UNION ALL (SELECT f FROM (SELECT DISTINCT french AS f FROM public.words WHERE list_id = _d.list_id AND french <> _w.french) x ORDER BY random() LIMIT 3)
  ) z;
  IF _p.q_started_at IS NULL THEN
    UPDATE public.duel_players SET q_started_at = now() WHERE duel_id = _duel AND student_id = _me;
  END IF;
  RETURN jsonb_build_object('done', false, 'index', _p.idx, 'total', array_length(_d.word_ids, 1), 'german', _w.german, 'choices', to_jsonb(_choices));
END $$;