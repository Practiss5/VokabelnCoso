ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_mode_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_mode_check CHECK (mode IN ('flashcard','choice','typing','context'));