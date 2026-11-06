ALTER TABLE public.homeworks ADD COLUMN archived_at timestamptz;
CREATE OR REPLACE FUNCTION public.set_homework_archived(_hw uuid, _archived boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'teacher') THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  UPDATE public.homeworks SET archived_at = CASE WHEN _archived THEN now() ELSE NULL END
  WHERE id = _hw AND teacher_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Devoir introuvable'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_homework_archived(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_homework_archived(uuid, boolean) TO authenticated;