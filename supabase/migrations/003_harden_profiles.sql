-- Keep public member profiles separate from private Auth credentials.
-- Supabase Auth stores email/password. public.profiles stores display name only.

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name;

  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS email;
