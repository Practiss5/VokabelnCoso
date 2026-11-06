ALTER TABLE public.homeworks ADD COLUMN coverage_rule boolean NOT NULL DEFAULT true;
UPDATE public.homeworks h SET coverage_rule = false
WHERE EXISTS (SELECT 1 FROM public.homeworks n WHERE n.class_id = h.class_id AND n.created_at > h.created_at);