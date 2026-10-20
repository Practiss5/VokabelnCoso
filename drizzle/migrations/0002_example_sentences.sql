ALTER TABLE public.words ADD COLUMN IF NOT EXISTS example_de text NOT NULL DEFAULT '';
ALTER TABLE public.words ADD COLUMN IF NOT EXISTS example_fr text NOT NULL DEFAULT '';
ALTER TABLE public.vocab_lists ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'A1';
CREATE OR REPLACE FUNCTION public.validate_list_level() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  if new.level not in ('A1','A2','B1') then new.level := 'A1'; end if;
  return new;
end $$;
DROP TRIGGER IF EXISTS vocab_lists_level ON public.vocab_lists;
CREATE TRIGGER vocab_lists_level BEFORE INSERT OR UPDATE ON public.vocab_lists FOR EACH ROW EXECUTE FUNCTION public.validate_list_level();