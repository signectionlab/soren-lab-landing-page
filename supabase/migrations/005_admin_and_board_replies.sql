-- 관리자 권한 + 게시판 답글 (재실행해도 오류 없음)
-- Supabase Dashboard → SQL Editor → New query → 전체 붙여넣기 → Run

-- profiles: email(없으면 추가) + is_admin
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- auth.users → profiles 동기화 (행이 없으면 생성)
INSERT INTO public.profiles (id, display_name, email)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'display_name', ''),
  COALESCE(u.email, '')
FROM auth.users AS u
ON CONFLICT (id) DO UPDATE
  SET email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
      display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), public.profiles.display_name);

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.lock_profile_admin_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    NEW.is_admin := OLD.is_admin;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_profile_admin_flag ON public.profiles;
CREATE TRIGGER lock_profile_admin_flag
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_profile_admin_flag();

-- 문의: 관리자만 조회/수정/삭제
DROP POLICY IF EXISTS "auth_select_inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "auth_update_inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "auth_delete_inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "admin_select_inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "admin_update_inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "admin_delete_inquiries" ON public.inquiries;

CREATE POLICY "admin_select_inquiries"
  ON public.inquiries
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "admin_update_inquiries"
  ON public.inquiries
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "admin_delete_inquiries"
  ON public.inquiries
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());

-- 게시글: 작성자 또는 관리자 삭제
DROP POLICY IF EXISTS "auth_delete_own_board_posts" ON public.board_posts;
CREATE POLICY "auth_delete_own_board_posts"
  ON public.board_posts
  FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() OR public.is_admin_user());

-- 게시판 답글
CREATE TABLE IF NOT EXISTS public.board_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS board_replies_post_id_idx
  ON public.board_replies (post_id, created_at ASC);

DROP TRIGGER IF EXISTS update_board_replies_updated_at ON public.board_replies;
CREATE TRIGGER update_board_replies_updated_at
  BEFORE UPDATE ON public.board_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.board_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_board_replies" ON public.board_replies;
DROP POLICY IF EXISTS "admin_insert_board_replies" ON public.board_replies;
DROP POLICY IF EXISTS "admin_update_board_replies" ON public.board_replies;
DROP POLICY IF EXISTS "admin_delete_board_replies" ON public.board_replies;

CREATE POLICY "auth_select_board_replies"
  ON public.board_replies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin_insert_board_replies"
  ON public.board_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user() AND author_id = auth.uid());

CREATE POLICY "admin_update_board_replies"
  ON public.board_replies
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user() AND author_id = auth.uid())
  WITH CHECK (public.is_admin_user() AND author_id = auth.uid());

CREATE POLICY "admin_delete_board_replies"
  ON public.board_replies
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user() AND author_id = auth.uid());

-- 관리자 지정 (auth.users 이메일 기준 — profiles.email 없어도 동작)
UPDATE public.profiles AS p
SET is_admin = true
FROM auth.users AS u
WHERE p.id = u.id
  AND u.email = 'signectionlab@gmail.com';
