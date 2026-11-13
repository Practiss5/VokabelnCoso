CREATE OR REPLACE FUNCTION public.my_class_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select p.class_id from public.profiles p
  where p.id = auth.uid()
    and not exists (select 1 from public.student_codes sc where sc.student_id = p.id and sc.revoked)
$$;

CREATE OR REPLACE FUNCTION public.student_can_access_list(_list uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select exists (
    select 1 from public.list_assignments a
    join public.profiles p on p.class_id = a.class_id
    where a.list_id = _list and p.id = auth.uid()
      and not exists (select 1 from public.student_codes sc where sc.student_id = p.id and sc.revoked)
  )
$$;