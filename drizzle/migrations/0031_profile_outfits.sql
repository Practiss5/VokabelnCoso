alter table public.profiles add column if not exists outfit jsonb not null default '{}'::jsonb;

create or replace function public.save_my_outfit(_outfit jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_mascot text;
  v_clean jsonb;
  v_slot text;
  v_item text;
  v_slots text[] := array['hat','eyes','neck','hand','bg'];
  v_items text[] := array['cap','tyrol','bonnet','dj','crown','aviator','sport','monocle','scarf','bow','vest','tshirt','apron','medal','pretzel','flag','quill','mic','mug','forest','matterhorn','board','castle','aurora'];
begin
  if not public.has_role(auth.uid(), 'student') then
    raise exception 'Réservé aux élèves.';
  end if;
  v_mascot := _outfit ->> 'mascot';
  if v_mascot is null or v_mascot not in ('dackel','baer','fuchs','murmeltier','eule','wolf','eichhoernchen','bernhardiner','steinbock','igel') then
    v_mascot := 'dackel';
  end if;
  v_clean := jsonb_build_object('mascot', v_mascot);
  foreach v_slot in array v_slots loop
    v_item := _outfit ->> v_slot;
    if v_item is not null and v_item = any(v_items) then
      v_clean := v_clean || jsonb_build_object(v_slot, v_item);
    end if;
  end loop;
  update public.profiles set outfit = v_clean where id = auth.uid();
end $$;

grant execute on function public.save_my_outfit(jsonb) to authenticated;

drop function public.duel_classmates();
create function public.duel_classmates()
returns table(id uuid, name text, outfit jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id, coalesce(nullif(p.full_name, ''), nullif(sc.label, ''), 'Un camarade'), p.outfit
  from public.profiles p
  join public.user_roles r on r.user_id = p.id and r.role = 'student'
  left join public.student_codes sc on sc.student_id = p.id and not sc.revoked
  where public.has_role(auth.uid(), 'student') and p.class_id = public.my_class_id() and p.id <> auth.uid()
  order by 2
$$;

drop function public.my_duels();
create function public.my_duels()
returns table(duel_id uuid, list_title text, created_at timestamptz, expires_at timestamptz, opponent text, opp_outfit jsonb, my_outfit jsonb, my_idx integer, total integer, my_score integer, my_ms integer, my_finished boolean, opp_finished boolean, opp_score integer, opp_ms integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.id, l.title, d.created_at, d.expires_at, coalesce(nullif(op.full_name, ''), 'Un camarade'),
    op.outfit, mp.outfit,
    me.idx, array_length(d.word_ids, 1), me.score, me.total_ms, me.finished,
    o.finished,
    case when me.finished and o.finished then o.score end,
    case when me.finished and o.finished then o.total_ms end
  from public.duel_players me
  join public.duels d on d.id = me.duel_id
  join public.duel_players o on o.duel_id = d.id and o.student_id <> me.student_id
  left join public.profiles op on op.id = o.student_id
  left join public.profiles mp on mp.id = me.student_id
  join public.vocab_lists l on l.id = d.list_id
  where me.student_id = auth.uid() and d.created_at > now() - interval '14 days'
  order by d.created_at desc limit 20
$$;

drop function public.class_match_top(uuid);
create function public.class_match_top(_list uuid)
returns table(full_name text, best_run integer, is_me boolean, outfit jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(nullif(p.full_name,''),'Élève'), max(g.best_run)::int, g.student_id = auth.uid(), p.outfit
  from public.match_games g join public.profiles p on p.id = g.student_id
  where g.class_id = public.my_class_id() and g.list_id = _list and public.my_class_id() is not null
  group by g.student_id, p.full_name, p.outfit order by 2 desc limit 5
$$;