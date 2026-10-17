
create type public.app_role as enum ('teacher', 'student');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  class_id uuid,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  name text not null,
  join_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_at timestamptz not null default now()
);

alter table public.profiles add constraint profiles_class_fk foreign key (class_id) references public.classes(id) on delete set null;

create table public.vocab_lists (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.words (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.vocab_lists(id) on delete cascade,
  german text not null,
  french text not null,
  created_at timestamptz not null default now()
);
create index on public.words(list_id);

create table public.list_assignments (
  list_id uuid not null references public.vocab_lists(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, class_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  word_id uuid not null references public.words(id) on delete cascade,
  mode text not null check (mode in ('flashcard','choice','typing')),
  correct boolean not null,
  created_at timestamptz not null default now()
);
create index on public.reviews(student_id, created_at desc);

create table public.word_progress (
  student_id uuid not null,
  word_id uuid not null references public.words(id) on delete cascade,
  repetitions int not null default 0,
  interval_days numeric not null default 0,
  ease numeric not null default 2.5,
  due_at timestamptz not null default now(),
  correct_count int not null default 0,
  wrong_count int not null default 0,
  last_reviewed_at timestamptz,
  primary key (student_id, word_id)
);

-- Grants
grant select on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.vocab_lists to authenticated;
grant select, insert, update, delete on public.words to authenticated;
grant select, insert, delete on public.list_assignments to authenticated;
grant select on public.reviews to authenticated;
grant select on public.word_progress to authenticated;
grant all on public.profiles, public.user_roles, public.classes, public.vocab_lists, public.words, public.list_assignments, public.reviews, public.word_progress to service_role;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.classes enable row level security;
alter table public.vocab_lists enable row level security;
alter table public.words enable row level security;
alter table public.list_assignments enable row level security;
alter table public.reviews enable row level security;
alter table public.word_progress enable row level security;

-- Helper functions
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.my_class_id()
returns uuid language sql stable security definer set search_path = public as $$
  select class_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_teacher_of_student(_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p join public.classes c on c.id = p.class_id
    where p.id = _student and c.teacher_id = auth.uid()
  )
$$;

create or replace function public.student_can_access_list(_list uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.list_assignments a
    join public.profiles p on p.class_id = a.class_id
    where a.list_id = _list and p.id = auth.uid()
  )
$$;

create or replace function public.owns_list(_list uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vocab_lists where id = _list and teacher_id = auth.uid())
$$;

-- Policies: profiles
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "teacher sees class students" on public.profiles for select to authenticated using (public.is_teacher_of_student(id));

-- user_roles
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- classes
create policy "teacher reads own classes" on public.classes for select to authenticated using (teacher_id = auth.uid());
create policy "student reads own class" on public.classes for select to authenticated using (id = public.my_class_id());
create policy "teacher creates classes" on public.classes for insert to authenticated with check (teacher_id = auth.uid() and public.has_role(auth.uid(), 'teacher'));
create policy "teacher updates classes" on public.classes for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid() and public.has_role(auth.uid(), 'teacher'));
create policy "teacher deletes classes" on public.classes for delete to authenticated using (teacher_id = auth.uid() and public.has_role(auth.uid(), 'teacher'));

-- vocab_lists
create policy "teacher reads own lists" on public.vocab_lists for select to authenticated using (teacher_id = auth.uid());
create policy "student reads assigned lists" on public.vocab_lists for select to authenticated using (public.student_can_access_list(id));
create policy "teacher creates lists" on public.vocab_lists for insert to authenticated with check (teacher_id = auth.uid() and public.has_role(auth.uid(), 'teacher'));
create policy "teacher updates lists" on public.vocab_lists for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid() and public.has_role(auth.uid(), 'teacher'));
create policy "teacher deletes lists" on public.vocab_lists for delete to authenticated using (teacher_id = auth.uid() and public.has_role(auth.uid(), 'teacher'));

-- words
create policy "teacher reads words" on public.words for select to authenticated using (public.owns_list(list_id));
create policy "student reads assigned words" on public.words for select to authenticated using (public.student_can_access_list(list_id));
create policy "teacher inserts words" on public.words for insert to authenticated with check (public.owns_list(list_id) and public.has_role(auth.uid(), 'teacher'));
create policy "teacher updates words" on public.words for update to authenticated using (public.owns_list(list_id)) with check (public.owns_list(list_id) and public.has_role(auth.uid(), 'teacher'));
create policy "teacher deletes words" on public.words for delete to authenticated using (public.owns_list(list_id) and public.has_role(auth.uid(), 'teacher'));

-- list_assignments
create policy "teacher reads assignments" on public.list_assignments for select to authenticated using (public.owns_list(list_id));
create policy "student reads own class assignments" on public.list_assignments for select to authenticated using (class_id = public.my_class_id());
create policy "teacher assigns" on public.list_assignments for insert to authenticated with check (
  public.has_role(auth.uid(), 'teacher') and public.owns_list(list_id)
  and exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));
create policy "teacher unassigns" on public.list_assignments for delete to authenticated using (public.owns_list(list_id));

-- reviews & progress: read only (writes go through record_answer)
create policy "student reads own reviews" on public.reviews for select to authenticated using (student_id = auth.uid());
create policy "teacher reads class reviews" on public.reviews for select to authenticated using (public.is_teacher_of_student(student_id));
create policy "student reads own progress" on public.word_progress for select to authenticated using (student_id = auth.uid());
create policy "teacher reads class progress" on public.word_progress for select to authenticated using (public.is_teacher_of_student(student_id));

-- New user: profile + student role (teacher role only granted by admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _class uuid;
begin
  select id into _class from public.classes
   where join_code = upper(trim(coalesce(new.raw_user_meta_data->>'class_code', '')));
  insert into public.profiles (id, full_name, class_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), _class);
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Student joins a class with code
create or replace function public.join_class(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _class uuid;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select id into _class from public.classes where join_code = upper(trim(_code));
  if _class is null then raise exception 'Code de classe inconnu'; end if;
  update public.profiles set class_id = _class where id = auth.uid();
  return _class;
end $$;

create or replace function public.update_my_name(_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set full_name = left(trim(_name), 100) where id = auth.uid();
end $$;

-- Record an answer with spaced repetition (SM-2 simplified)
create or replace function public.record_answer(_word uuid, _mode text, _correct boolean)
returns public.word_progress language plpgsql security definer set search_path = public as $$
declare
  _list uuid;
  p public.word_progress;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select list_id into _list from public.words where id = _word;
  if _list is null or not public.student_can_access_list(_list) then
    raise exception 'Accès refusé';
  end if;
  if _mode not in ('flashcard','choice','typing') then raise exception 'Mode invalide'; end if;

  insert into public.reviews (student_id, word_id, mode, correct) values (auth.uid(), _word, _mode, _correct);

  insert into public.word_progress (student_id, word_id) values (auth.uid(), _word)
  on conflict do nothing;
  select * into p from public.word_progress where student_id = auth.uid() and word_id = _word for update;

  if _correct then
    p.repetitions := p.repetitions + 1;
    p.interval_days := case when p.repetitions = 1 then 1
                            when p.repetitions = 2 then 3
                            else round(p.interval_days * p.ease, 1) end;
    p.ease := least(3.0, p.ease + 0.1);
    p.correct_count := p.correct_count + 1;
  else
    p.repetitions := 0;
    p.interval_days := 0;
    p.ease := greatest(1.3, p.ease - 0.2);
    p.wrong_count := p.wrong_count + 1;
  end if;
  p.due_at := case when _correct then now() + make_interval(secs => (p.interval_days * 86400)::int)
                   else now() + interval '10 minutes' end;
  p.last_reviewed_at := now();

  update public.word_progress set repetitions = p.repetitions, interval_days = p.interval_days,
    ease = p.ease, due_at = p.due_at, correct_count = p.correct_count, wrong_count = p.wrong_count,
    last_reviewed_at = p.last_reviewed_at
  where student_id = auth.uid() and word_id = _word;
  return p;
end $$;

revoke execute on function public.join_class(text), public.update_my_name(text), public.record_answer(uuid, text, boolean) from anon, public;
grant execute on function public.join_class(text), public.update_my_name(text), public.record_answer(uuid, text, boolean) to authenticated;
