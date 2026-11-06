CREATE OR REPLACE FUNCTION public.freeze_homework_words() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.word_ids IS NULL OR cardinality(NEW.word_ids) = 0 THEN
    NEW.word_ids := ARRAY(SELECT id FROM public.words WHERE list_id = NEW.list_id ORDER BY created_at, id);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.freeze_homework_words() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER homeworks_freeze_words BEFORE INSERT ON public.homeworks FOR EACH ROW EXECUTE FUNCTION public.freeze_homework_words();