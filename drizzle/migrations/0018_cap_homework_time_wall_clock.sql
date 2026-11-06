CREATE OR REPLACE FUNCTION public.add_homework_time(_hw uuid, _seconds integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _last timestamptz; _allowed integer;
BEGIN
  IF auth.uid() IS NULL OR _seconds IS NULL OR _seconds <= 0 THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM homeworks WHERE id = _hw AND class_id = my_class_id()) THEN RETURN; END IF;
  SELECT updated_at INTO _last FROM homework_time WHERE homework_id = _hw AND student_id = auth.uid() FOR UPDATE;
  IF _last IS NULL THEN
    INSERT INTO homework_time (homework_id, student_id, seconds, updated_at)
    VALUES (_hw, auth.uid(), LEAST(_seconds, 120), now())
    ON CONFLICT (homework_id, student_id) DO NOTHING;
    RETURN;
  END IF;
  -- Never credit more time than has really elapsed since the last save (2 s tolerance).
  _allowed := LEAST(_seconds, 120, GREATEST(0, floor(extract(epoch FROM now() - _last))::int + 2));
  IF _allowed <= 0 THEN RETURN; END IF;
  UPDATE homework_time SET seconds = seconds + _allowed, updated_at = now()
  WHERE homework_id = _hw AND student_id = auth.uid();
END $function$;