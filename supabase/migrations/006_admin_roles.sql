-- 관리자 역할 분리 (super / inquiries / board)
-- Supabase Dashboard → SQL Editor → New query → 파일 전체 복사 → Run

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_role text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_admin_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_admin_role_check
  CHECK (admin_role IS NULL OR admin_role IN ('super', 'inquiries', 'board'));

-- 기존 is_admin=true 계정 → super
UPDATE public.profiles
SET admin_role = 'super'
WHERE is_admin = true
  AND (admin_role IS NULL OR admin_role = '');

UPDATE public.profiles
SET is_admin = (admin_role IS NOT NULL)
WHERE admin_role IS NOT NULL OR is_admin = true;

CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT admin_role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_admin_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT admin_role IS NOT NULL FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_admin_access();
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT admin_role = 'super' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_inquiries()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT admin_role IN ('super', 'inquiries')
      FROM public.profiles
      WHERE id = auth.uid()
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_board()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT admin_role IN ('super', 'board')
      FROM public.profiles
      WHERE id = auth.uid()
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.lock_profile_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.admin_role IS DISTINCT FROM OLD.admin_role
     OR NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT public.is_super_admin() THEN
      NEW.admin_role := OLD.admin_role;
      NEW.is_admin := OLD.is_admin;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_profile_admin_flag ON public.profiles;
DROP TRIGGER IF EXISTS lock_profile_admin_fields ON public.profiles;
CREATE TRIGGER lock_profile_admin_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_profile_admin_fields();

CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_email text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
  normalized_role text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  normalized_role := NULLIF(trim(p_role), '');

  IF normalized_role IS NOT NULL
     AND normalized_role NOT IN ('super', 'inquiries', 'board') THEN
    RAISE EXCEPTION 'invalid admin role';
  END IF;

  SELECT u.id
  INTO target_id
  FROM auth.users AS u
  WHERE lower(u.email) = lower(trim(p_email))
  LIMIT 1;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  INSERT INTO public.profiles (id, display_name, email, is_admin, admin_role)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data ->> 'display_name', ''),
    COALESCE(u.email, ''),
    normalized_role IS NOT NULL,
    normalized_role
  FROM auth.users AS u
  WHERE u.id = target_id
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
        display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), public.profiles.display_name),
        admin_role = EXCLUDED.admin_role,
        is_admin = EXCLUDED.is_admin;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(text, text) TO authenticated;

-- 문의: super + inquiries
DROP POLICY IF EXISTS "admin_select_inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "admin_update_inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "admin_delete_inquiries" ON public.inquiries;

CREATE POLICY "admin_select_inquiries"
  ON public.inquiries
  FOR SELECT
  TO authenticated
  USING (public.can_manage_inquiries());

CREATE POLICY "admin_update_inquiries"
  ON public.inquiries
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_inquiries())
  WITH CHECK (public.can_manage_inquiries());

CREATE POLICY "admin_delete_inquiries"
  ON public.inquiries
  FOR DELETE
  TO authenticated
  USING (public.can_manage_inquiries());

-- 게시글 삭제: 작성자 또는 super/board
DROP POLICY IF EXISTS "auth_delete_own_board_posts" ON public.board_posts;
CREATE POLICY "auth_delete_own_board_posts"
  ON public.board_posts
  FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() OR public.can_manage_board());

-- 게시판 답글: super + board
DROP POLICY IF EXISTS "admin_insert_board_replies" ON public.board_replies;
DROP POLICY IF EXISTS "admin_update_board_replies" ON public.board_replies;
DROP POLICY IF EXISTS "admin_delete_board_replies" ON public.board_replies;

CREATE POLICY "admin_insert_board_replies"
  ON public.board_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_board() AND author_id = auth.uid());

CREATE POLICY "admin_update_board_replies"
  ON public.board_replies
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_board() AND author_id = auth.uid())
  WITH CHECK (public.can_manage_board() AND author_id = auth.uid());

CREATE POLICY "admin_delete_board_replies"
  ON public.board_replies
  FOR DELETE
  TO authenticated
  USING (public.can_manage_board() AND author_id = auth.uid());

-- admin1~3: @soren.com 관리자 전용 계정
-- (계정 생성은 node scripts/setup-admin-users.js 실행)
UPDATE public.profiles AS p
SET admin_role = 'super',
    is_admin = true
FROM auth.users AS u
WHERE p.id = u.id
  AND lower(u.email) = lower('admin1@soren.com');

UPDATE public.profiles AS p
SET admin_role = 'inquiries',
    is_admin = true
FROM auth.users AS u
WHERE p.id = u.id
  AND lower(u.email) = lower('admin2@soren.com');

UPDATE public.profiles AS p
SET admin_role = 'board',
    is_admin = true
FROM auth.users AS u
WHERE p.id = u.id
  AND lower(u.email) = lower('admin3@soren.com');
