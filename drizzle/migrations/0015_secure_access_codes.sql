ALTER TABLE public.classes ALTER COLUMN join_code SET DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
ALTER TABLE public.list_folders ALTER COLUMN share_code SET DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
UPDATE public.classes SET join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
UPDATE public.list_folders SET share_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));