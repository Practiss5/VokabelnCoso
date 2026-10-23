ALTER TABLE public.list_folders ADD COLUMN share_code text NOT NULL DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
CREATE UNIQUE INDEX list_folders_share_code_key ON public.list_folders(share_code);

CREATE OR REPLACE FUNCTION public.copy_folder(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.list_folders; new_folder uuid; l record; new_list uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher') THEN RAISE EXCEPTION 'Réservé aux enseignants'; END IF;
  SELECT * INTO src FROM public.list_folders WHERE share_code = upper(trim(_code));
  IF NOT FOUND THEN RAISE EXCEPTION 'Code de classeur inconnu'; END IF;
  INSERT INTO public.list_folders(teacher_id, name) VALUES (auth.uid(), src.name) RETURNING id INTO new_folder;
  FOR l IN SELECT * FROM public.vocab_lists WHERE folder_id = src.id ORDER BY created_at LOOP
    INSERT INTO public.vocab_lists(teacher_id, title, description, level, folder_id)
      VALUES (auth.uid(), l.title, l.description, l.level, new_folder) RETURNING id INTO new_list;
    INSERT INTO public.words(list_id, german, french, example_de, example_fr)
      SELECT new_list, german, french, example_de, example_fr FROM public.words WHERE list_id = l.id ORDER BY created_at;
  END LOOP;
  RETURN new_folder;
END $$;
REVOKE ALL ON FUNCTION public.copy_folder(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.copy_folder(text) TO authenticated;