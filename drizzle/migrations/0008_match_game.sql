CREATE TABLE public.match_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  list_id uuid NOT NULL,
  pairs int NOT NULL CHECK (pairs BETWEEN 0 AND 1000),
  best_run int NOT NULL CHECK (best_run BETWEEN 0 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.match_games TO authenticated;
GRANT ALL ON public.match_games TO service_role;
ALTER TABLE public.match_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own games" ON public.match_games FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE INDEX match_games_class_list ON public.match_games (class_id, list_id);

CREATE OR REPLACE FUNCTION public.record_match(_list uuid, _pairs int, _best_run int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _class uuid; _n int;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if not public.student_can_access_list(_list) then raise exception 'Accès refusé'; end if;
  _class := public.my_class_id();
  if _class is null then raise exception 'Aucune classe'; end if;
  select count(*) into _n from public.words where list_id = _list;
  if _pairs < 0 or _best_run < 0 or _best_run > _pairs or _pairs > _n + 6 then raise exception 'Score invalide'; end if;
  insert into public.match_games (student_id, class_id, list_id, pairs, best_run) values (auth.uid(), _class, _list, _pairs, _best_run);
end $$;

CREATE OR REPLACE FUNCTION public.class_match_top(_list uuid)
RETURNS TABLE(full_name text, best_run int, is_me boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce(nullif(p.full_name,''),'Élève'), max(g.best_run)::int, g.student_id = auth.uid()
  from public.match_games g join public.profiles p on p.id = g.student_id
  where g.class_id = public.my_class_id() and g.list_id = _list and public.my_class_id() is not null
  group by g.student_id, p.full_name order by 2 desc limit 5
$$;
REVOKE ALL ON FUNCTION public.record_match(uuid,int,int) FROM public, anon;
REVOKE ALL ON FUNCTION public.class_match_top(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_match(uuid,int,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.class_match_top(uuid) TO authenticated;