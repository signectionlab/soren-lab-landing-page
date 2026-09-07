-- SOREN LAB member profiles + protected board
-- Supabase Dashboard -> SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.board_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS board_posts_created_at_idx
  ON public.board_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS board_posts_author_id_idx
  ON public.board_posts (author_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_board_posts_updated_at ON public.board_posts;
CREATE TRIGGER update_board_posts_updated_at
  BEFORE UPDATE ON public.board_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

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

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_profiles" ON public.profiles;
CREATE POLICY "auth_select_profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_insert_own_profile" ON public.profiles;
CREATE POLICY "auth_insert_own_profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "auth_update_own_profile" ON public.profiles;
CREATE POLICY "auth_update_own_profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "auth_select_board_posts" ON public.board_posts;
CREATE POLICY "auth_select_board_posts"
  ON public.board_posts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_insert_own_board_posts" ON public.board_posts;
CREATE POLICY "auth_insert_own_board_posts"
  ON public.board_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "auth_update_own_board_posts" ON public.board_posts;
CREATE POLICY "auth_update_own_board_posts"
  ON public.board_posts
  FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "auth_delete_own_board_posts" ON public.board_posts;
CREATE POLICY "auth_delete_own_board_posts"
  ON public.board_posts
  FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());
