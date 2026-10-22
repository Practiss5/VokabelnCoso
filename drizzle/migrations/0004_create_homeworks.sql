CREATE TABLE public.homeworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  instructions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homeworks TO authenticated;
GRANT ALL ON public.homeworks TO service_role;
ALTER TABLE public.homeworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student reads class homeworks" ON public.homeworks FOR SELECT TO authenticated USING (class_id = public.my_class_id());
CREATE POLICY "teacher reads homeworks" ON public.homeworks FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "teacher creates homeworks" ON public.homeworks FOR INSERT TO authenticated WITH CHECK (
  teacher_id = auth.uid() AND public.has_role(auth.uid(), 'teacher') AND public.owns_list(list_id)
  AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.teacher_id = auth.uid()));
CREATE POLICY "teacher deletes homeworks" ON public.homeworks FOR DELETE TO authenticated USING (teacher_id = auth.uid());
CREATE INDEX homeworks_class_idx ON public.homeworks(class_id);