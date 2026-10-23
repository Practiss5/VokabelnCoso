CREATE TABLE public.list_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_folders TO authenticated;
GRANT ALL ON public.list_folders TO service_role;
ALTER TABLE public.list_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher reads folders" ON public.list_folders FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "teacher creates folders" ON public.list_folders FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "teacher updates folders" ON public.list_folders FOR UPDATE TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "teacher deletes folders" ON public.list_folders FOR DELETE TO authenticated USING (teacher_id = auth.uid());
ALTER TABLE public.vocab_lists ADD COLUMN folder_id uuid REFERENCES public.list_folders(id) ON DELETE SET NULL;