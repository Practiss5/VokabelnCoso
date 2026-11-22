GRANT SELECT (student_id, best_run) ON public.match_sessions TO authenticated;
GRANT ALL ON public.match_sessions TO service_role;
CREATE POLICY "Students read own match best run" ON public.match_sessions FOR SELECT TO authenticated USING (student_id = auth.uid());