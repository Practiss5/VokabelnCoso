CREATE TABLE public.student_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete set null,
  label text not null default '',
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_codes TO authenticated;
GRANT ALL ON public.student_codes TO service_role;

ALTER TABLE public.student_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher manages class codes" ON public.student_codes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = student_codes.class_id AND c.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = student_codes.class_id AND c.teacher_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.generate_student_codes(_class uuid, _count integer)
RETURNS SETOF public.student_codes
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
declare _i int; _code text; _alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if not exists (select 1 from public.classes where id = _class and teacher_id = auth.uid()) then
    raise exception 'Réservé à l''enseignant de la classe';
  end if;
  if _count < 1 or _count > 60 then raise exception 'Nombre invalide (1 à 60)'; end if;
  for _i in 1.._count loop
    loop
      select string_agg(substr(_alphabet, floor(random()*31)::int + 1, 1), '') into _code from generate_series(1,8);
      exit when not exists (select 1 from public.student_codes where code = _code);
    end loop;
    insert into public.student_codes (code, class_id) values (_code, _class);
  end loop;
  return query select * from public.student_codes where class_id = _class order by created_at desc limit _count;
end $fn$;

CREATE OR REPLACE FUNCTION public.check_student_code(_code text)
RETURNS TABLE(class_name text, activated boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
  select c.name, sc.student_id is not null
  from public.student_codes sc join public.classes c on c.id = sc.class_id
  where sc.code = upper(trim(_code)) and not sc.revoked
$fn$;

GRANT EXECUTE ON FUNCTION public.check_student_code(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.purge_class_data(_class uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
begin
  if not exists (select 1 from public.classes where id = _class and teacher_id = auth.uid()) then
    raise exception 'Réservé à l''enseignant de la classe';
  end if;
  delete from public.reviews where student_id in (select id from public.profiles where class_id = _class);
  delete from public.skill_progress where student_id in (select id from public.profiles where class_id = _class);
  delete from public.word_progress where student_id in (select id from public.profiles where class_id = _class);
  delete from public.match_games where student_id in (select id from public.profiles where class_id = _class);
  delete from public.tetris_games where student_id in (select id from public.profiles where class_id = _class);
  delete from public.student_codes where class_id = _class;
  update public.profiles set class_id = null where class_id = _class;
end $fn$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
declare _class uuid; _code_id uuid;
begin
  if coalesce(new.raw_user_meta_data->>'student_code', '') <> '' then
    select sc.id, sc.class_id into _code_id, _class from public.student_codes sc
     where sc.code = upper(trim(new.raw_user_meta_data->>'student_code')) and not sc.revoked and sc.student_id is null;
  else
    select id into _class from public.classes
     where join_code = upper(trim(coalesce(new.raw_user_meta_data->>'class_code', '')));
  end if;
  insert into public.profiles (id, full_name, class_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), _class);
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  if _code_id is not null then
    update public.student_codes set student_id = new.id where id = _code_id;
  end if;
  return new;
end $fn$;