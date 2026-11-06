CREATE TABLE public.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
  word_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '48 hours'
);
CREATE TABLE public.duel_players (
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  idx integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  total_ms integer NOT NULL DEFAULT 0,
  q_started_at timestamptz,
  finished boolean NOT NULL DEFAULT false,
  PRIMARY KEY (duel_id, student_id)
);
GRANT ALL ON public.duels TO service_role;
GRANT ALL ON public.duel_players TO service_role;
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_players ENABLE ROW LEVEL SECURITY;
-- No direct access: everything goes through the functions below (server-checked answers and timing).

CREATE OR REPLACE FUNCTION public.start_duel(_list uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _class uuid; _opp uuid; _words uuid[]; _id uuid;
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'student') THEN RAISE EXCEPTION 'Réservé aux élèves'; END IF;
  _class := public.my_class_id();
  IF _class IS NULL OR NOT public.student_can_access_list(_list) THEN RAISE EXCEPTION 'Liste non disponible'; END IF;
  IF (SELECT count(*) FROM public.duels d JOIN public.duel_players p ON p.duel_id = d.id
      WHERE p.student_id = _me AND d.created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'Maximum 10 duels par jour';
  END IF;
  SELECT p.id INTO _opp FROM public.profiles p JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'student'
    WHERE p.class_id = _class AND p.id <> _me ORDER BY random() LIMIT 1;
  IF _opp IS NULL THEN RAISE EXCEPTION 'Aucun camarade disponible dans ta classe'; END IF;
  SELECT array_agg(id) INTO _words FROM (SELECT id FROM public.words WHERE list_id = _list ORDER BY random() LIMIT 10) w;
  IF coalesce(array_length(_words, 1), 0) < 4 THEN RAISE EXCEPTION 'La liste est trop courte pour un duel'; END IF;
  INSERT INTO public.duels (class_id, list_id, word_ids) VALUES (_class, _list, _words) RETURNING id INTO _id;
  INSERT INTO public.duel_players (duel_id, student_id) VALUES (_id, _me), (_id, _opp);
  RETURN _id;
END $$;

-- Returns the current question (German word + 4 French choices) and starts its timer.
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
  SELECT array_agg(f ORDER BY random()) INTO _choices FROM (
    SELECT _w.french AS f
    UNION SELECT french FROM (SELECT DISTINCT french FROM public.words WHERE list_id = _d.list_id AND french <> _w.french ORDER BY 1) x
      WHERE random() < 1 LIMIT 0
  ) s;
  SELECT array_agg(f ORDER BY random()) INTO _choices FROM (
    SELECT _w.french AS f
    UNION ALL (SELECT DISTINCT ON (french) french FROM public.words WHERE list_id = _d.list_id AND french <> _w.french ORDER BY french, random()) 
  ) s;
  _choices := (SELECT array_agg(c ORDER BY random()) FROM (
    SELECT _w.french AS c UNION ALL (SELECT c FROM unnest(_choices) c WHERE c <> _w.french ORDER BY random() LIMIT 3)) z);
  IF _p.q_started_at IS NULL THEN
    UPDATE public.duel_players SET q_started_at = now() WHERE duel_id = _duel AND student_id = _me;
  END IF;
  RETURN jsonb_build_object('done', false, 'index', _p.idx, 'total', array_length(_d.word_ids, 1), 'german', _w.german, 'choices', to_jsonb(_choices));
END $$;

CREATE OR REPLACE FUNCTION public.answer_duel(_duel uuid, _choice text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _p public.duel_players; _d public.duels; _w public.words; _ok boolean; _ms integer; _n integer;
BEGIN
  SELECT * INTO _p FROM public.duel_players WHERE duel_id = _duel AND student_id = _me FOR UPDATE;
  IF NOT FOUND OR _p.finished OR _p.q_started_at IS NULL THEN RAISE EXCEPTION 'Question non disponible'; END IF;
  SELECT * INTO _d FROM public.duels WHERE id = _duel;
  IF _d.expires_at < now() THEN RAISE EXCEPTION 'Ce duel a expiré'; END IF;
  SELECT * INTO _w FROM public.words WHERE id = _d.word_ids[_p.idx + 1];
  _ok := _choice = _w.french;
  _ms := least(60000, (extract(epoch FROM now() - _p.q_started_at) * 1000)::integer);
  _n := array_length(_d.word_ids, 1);
  UPDATE public.duel_players SET idx = idx + 1, score = score + (CASE WHEN _ok THEN 1 ELSE 0 END),
    total_ms = total_ms + _ms, q_started_at = NULL, finished = (idx + 1 >= _n)
    WHERE duel_id = _duel AND student_id = _me;
  RETURN jsonb_build_object('correct', _ok, 'answer', _w.french);
END $$;

-- The student's duels; the opponent's score is only shown once both have finished.
CREATE OR REPLACE FUNCTION public.my_duels() RETURNS TABLE(
  duel_id uuid, list_title text, created_at timestamptz, expires_at timestamptz, opponent text,
  my_idx integer, total integer, my_score integer, my_ms integer, my_finished boolean,
  opp_finished boolean, opp_score integer, opp_ms integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, l.title, d.created_at, d.expires_at, coalesce(nullif(op.full_name, ''), 'Un camarade'),
    me.idx, array_length(d.word_ids, 1), me.score, me.total_ms, me.finished,
    o.finished,
    CASE WHEN me.finished AND o.finished THEN o.score END,
    CASE WHEN me.finished AND o.finished THEN o.total_ms END
  FROM public.duel_players me
  JOIN public.duels d ON d.id = me.duel_id
  JOIN public.duel_players o ON o.duel_id = d.id AND o.student_id <> me.student_id
  LEFT JOIN public.profiles op ON op.id = o.student_id
  JOIN public.vocab_lists l ON l.id = d.list_id
  WHERE me.student_id = auth.uid() AND d.created_at > now() - interval '14 days'
  ORDER BY d.created_at DESC LIMIT 20
$$;

REVOKE ALL ON FUNCTION public.start_duel(uuid), public.duel_question(uuid), public.answer_duel(uuid, text), public.my_duels() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_duel(uuid), public.duel_question(uuid), public.answer_duel(uuid, text), public.my_duels() TO authenticated;