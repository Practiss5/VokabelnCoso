ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS duels_enabled boolean NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.start_duel(uuid);
CREATE OR REPLACE FUNCTION public.start_duel(_list uuid, _opponent uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _class uuid; _opp uuid; _words uuid[]; _id uuid;
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'student') THEN RAISE EXCEPTION 'Réservé aux élèves'; END IF;
  _class := public.my_class_id();
  IF _class IS NULL OR NOT public.student_can_access_list(_list) THEN RAISE EXCEPTION 'Liste non disponible'; END IF;
  IF NOT (SELECT duels_enabled FROM public.classes WHERE id = _class) THEN RAISE EXCEPTION 'Les duels sont désactivés pour ta classe'; END IF;
  IF (SELECT count(*) FROM public.duels d JOIN public.duel_players p ON p.duel_id = d.id
      WHERE p.student_id = _me AND d.created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'Maximum 10 duels par jour';
  END IF;
  IF _opponent IS NOT NULL THEN
    SELECT p.id INTO _opp FROM public.profiles p JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'student'
      WHERE p.id = _opponent AND p.class_id = _class AND p.id <> _me;
    IF _opp IS NULL THEN RAISE EXCEPTION 'Ce camarade n''est pas dans ta classe'; END IF;
  ELSE
    SELECT p.id INTO _opp FROM public.profiles p JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'student'
      WHERE p.class_id = _class AND p.id <> _me ORDER BY random() LIMIT 1;
  END IF;
  IF _opp IS NULL THEN RAISE EXCEPTION 'Aucun camarade disponible dans ta classe'; END IF;
  SELECT array_agg(id) INTO _words FROM (SELECT id FROM public.words WHERE list_id = _list ORDER BY random() LIMIT 10) w;
  IF coalesce(array_length(_words, 1), 0) < 4 THEN RAISE EXCEPTION 'La liste est trop courte pour un duel'; END IF;
  INSERT INTO public.duels (class_id, list_id, word_ids) VALUES (_class, _list, _words) RETURNING id INTO _id;
  INSERT INTO public.duel_players (duel_id, student_id) VALUES (_id, _me), (_id, _opp);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.duel_classmates() RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, coalesce(nullif(p.full_name, ''), nullif(sc.label, ''), 'Un camarade')
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'student'
  LEFT JOIN public.student_codes sc ON sc.student_id = p.id AND NOT sc.revoked
  WHERE public.has_role(auth.uid(), 'student') AND p.class_id = public.my_class_id() AND p.id <> auth.uid()
  ORDER BY 2
$$;

CREATE OR REPLACE FUNCTION public.duels_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT duels_enabled FROM public.classes WHERE id = public.my_class_id()), false)
$$;

REVOKE ALL ON FUNCTION public.start_duel(uuid, uuid), public.duel_classmates(), public.duels_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_duel(uuid, uuid), public.duel_classmates(), public.duels_enabled() TO authenticated;