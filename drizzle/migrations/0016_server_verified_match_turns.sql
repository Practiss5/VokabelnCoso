CREATE TABLE public.match_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
 list_id uuid NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
 waves jsonb NOT NULL,
 wave_index integer NOT NULL DEFAULT 0,
 found text[] NOT NULL DEFAULT '{}',
 pairs integer NOT NULL DEFAULT 0,
 current_run integer NOT NULL DEFAULT 0,
 best_run integer NOT NULL DEFAULT 0,
 finished boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.match_sessions TO service_role;
REVOKE ALL ON public.match_sessions FROM anon, authenticated;
ALTER TABLE public.match_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.start_match_session(_list uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 _class uuid; _ids uuid[]; _wave uuid[]; _waves jsonb := '[]'; _cards jsonb; _id uuid; _i integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'student') OR NOT public.student_can_access_list(_list) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
 _class := public.my_class_id();
 IF _class IS NULL THEN RAISE EXCEPTION 'Aucune classe'; END IF;
 SELECT array_agg(id ORDER BY random()) INTO _ids FROM public.words WHERE list_id = _list;
 IF coalesce(cardinality(_ids),0) = 0 OR cardinality(_ids) > 3000 THEN RAISE EXCEPTION 'Liste invalide'; END IF;
 FOR _i IN 1..cardinality(_ids) BY 6 LOOP
   _wave := _ids[_i:least(_i+5,cardinality(_ids))];
   IF cardinality(_wave) < 6 AND _i > 1 THEN
     SELECT _wave || array_agg(id) INTO _wave FROM (SELECT id FROM unnest(_ids) id WHERE NOT id = ANY(_wave) ORDER BY random() LIMIT 6-cardinality(_wave)) fill;
   END IF;
   SELECT jsonb_agg(card ORDER BY random()) INTO _cards FROM (
     SELECT jsonb_build_object('key',gen_random_uuid()::text,'wordId',w.id,'side','de','text',w.german) card FROM public.words w WHERE w.id = ANY(_wave)
     UNION ALL
     SELECT jsonb_build_object('key',gen_random_uuid()::text,'wordId',w.id,'side','fr','text',w.french) FROM public.words w WHERE w.id = ANY(_wave)
   ) c;
   _waves := _waves || jsonb_build_array(_cards);
 END LOOP;
 INSERT INTO public.match_sessions(student_id,class_id,list_id,waves) VALUES(auth.uid(),_class,_list,_waves) RETURNING id INTO _id;
 RETURN jsonb_build_object('id',_id,'cards',_waves->0,'wave',1,'totalWaves',jsonb_array_length(_waves),'pairs',0,'run',0,'bestRun',0,'finished',false);
END $$;
REVOKE ALL ON FUNCTION public.start_match_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_match_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.play_match_turn(_session uuid, _first text, _second text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.match_sessions; a jsonb; b jsonb; _ok boolean; _new_wave boolean := false;
BEGIN
 SELECT * INTO s FROM public.match_sessions WHERE id=_session AND student_id=auth.uid() FOR UPDATE;
 IF s.id IS NULL OR s.finished OR s.created_at < now()-interval '2 hours' OR NOT public.student_can_access_list(s.list_id) OR s.class_id IS DISTINCT FROM public.my_class_id() THEN RAISE EXCEPTION 'Partie indisponible'; END IF;
 SELECT value INTO a FROM jsonb_array_elements(s.waves->s.wave_index) WHERE value->>'key'=_first;
 SELECT value INTO b FROM jsonb_array_elements(s.waves->s.wave_index) WHERE value->>'key'=_second;
 IF a IS NULL OR b IS NULL OR a->>'side'=b->>'side' OR a->>'wordId'=ANY(s.found) OR b->>'wordId'=ANY(s.found) THEN RAISE EXCEPTION 'Cartes invalides'; END IF;
 _ok := a->>'wordId'=b->>'wordId';
 IF _ok THEN
   s.found := array_append(s.found,a->>'wordId'); s.pairs := s.pairs+1; s.current_run := s.current_run+1; s.best_run := greatest(s.best_run,s.current_run);
 ELSE s.current_run := 0; END IF;
 IF cardinality(s.found)*2=jsonb_array_length(s.waves->s.wave_index) THEN
   _new_wave := true;
   IF s.wave_index+1=jsonb_array_length(s.waves) THEN
     s.finished := true;
     INSERT INTO public.match_games(student_id,class_id,list_id,pairs,best_run) VALUES(s.student_id,s.class_id,s.list_id,s.pairs,s.best_run);
   ELSE s.wave_index := s.wave_index+1; s.found := '{}'; END IF;
 END IF;
 UPDATE public.match_sessions SET found=s.found,pairs=s.pairs,current_run=s.current_run,best_run=s.best_run,wave_index=s.wave_index,finished=s.finished WHERE id=s.id;
 RETURN jsonb_build_object('id',s.id,'cards',s.waves->s.wave_index,'wave',s.wave_index+1,'totalWaves',jsonb_array_length(s.waves),'pairs',s.pairs,'run',s.current_run,'bestRun',s.best_run,'finished',s.finished,'correct',_ok,'found',to_jsonb(s.found),'newWave',_new_wave);
END $$;
REVOKE ALL ON FUNCTION public.play_match_turn(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.play_match_turn(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_match(_list uuid, _pairs integer, _best_run integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Mets à jour la page pour jouer une partie vérifiée'; END $$;
REVOKE ALL ON FUNCTION public.record_match(uuid,integer,integer) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.record_match(uuid,integer,integer) IS 'DEPRECATED: scores are calculated exclusively by play_match_turn from server-owned sessions';