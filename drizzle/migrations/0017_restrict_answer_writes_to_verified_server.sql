DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.record_answer(uuid,text,boolean,text,text)'::regprocedure) INTO definition;
 definition := replace(definition, 'public.record_answer(_word uuid, _mode text, _correct boolean, _given text DEFAULT NULL::text, _error text DEFAULT NULL::text)', 'public.record_verified_answer(_student uuid, _word uuid, _mode text, _correct boolean, _given text DEFAULT NULL::text, _error text DEFAULT NULL::text)');
 definition := replace(definition, 'auth.uid()', '_student');
 definition := replace(definition, 'not public.student_can_access_list(_list)', 'not exists (select 1 from public.profiles pr join public.list_assignments la on la.class_id=pr.class_id where pr.id=_student and la.list_id=_list)');
 EXECUTE definition;
END $migration$;
REVOKE ALL ON FUNCTION public.record_verified_answer(uuid,uuid,text,boolean,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_answer(uuid,uuid,text,boolean,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.record_answer(_word uuid, _mode text, _correct boolean, _given text DEFAULT NULL, _error text DEFAULT NULL)
RETURNS public.skill_progress LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Mets à jour la page pour enregistrer une réponse vérifiée'; END $$;
REVOKE ALL ON FUNCTION public.record_answer(uuid,text,boolean,text,text) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.record_answer(uuid,text,boolean,text,text) IS 'DEPRECATED: replaced by authenticated submitAnswer and service-only record_verified_answer; never trusts browser correctness';