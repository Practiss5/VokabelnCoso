ALTER TABLE public.homeworks ADD COLUMN word_ids uuid[];
ALTER TABLE public.homeworks ADD COLUMN requirements jsonb;
COMMENT ON COLUMN public.homeworks.word_ids IS 'Selected words; NULL = whole list';
COMMENT ON COLUMN public.homeworks.requirements IS 'Map review mode -> success rate (0.6..1); NULL = legacy 80% QCM + 60% writing';