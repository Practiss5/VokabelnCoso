CREATE TABLE public.tetris_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL DEFAULT auth.uid(),
  list_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  level_reached integer NOT NULL DEFAULT 1,
  translation_ok integer NOT NULL DEFAULT 0,
  translation_ko integer NOT NULL DEFAULT 0,
  speaking_ok integer NOT NULL DEFAULT 0,
  speaking_ko integer NOT NULL DEFAULT 0,
  writing_ok integer NOT NULL DEFAULT 0,
  writing_ko integer NOT NULL DEFAULT 0,
  missed_word_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.tetris_games TO authenticated;
GRANT ALL ON public.tetris_games TO service_role;
ALTER TABLE public.tetris_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tetris select" ON public.tetris_games FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "own tetris insert" ON public.tetris_games FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());