-- profiles 테이블에 이메일 / 이메일 인증 상태 컬럼 추가
-- Supabase Dashboard → SQL Editor에서 실행 (New query 권장)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);
CREATE INDEX IF NOT EXISTS profiles_email_verified_idx ON public.profiles (email_verified);

CREATE OR REPLACE FUNCTION public.sync_profile_from_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  confirmed_at_value timestamptz;
  is_verified boolean;
BEGIN
  confirmed_at_value := COALESCE(NEW.email_confirmed_at, NEW.confirmed_at);
  is_verified := confirmed_at_value IS NOT NULL;

  INSERT INTO public.profiles (
    id,
    display_name,
    email,
    email_verified,
    email_confirmed_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''),
    COALESCE(NEW.email, ''),
    is_verified,
    confirmed_at_value
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), public.profiles.display_name),
        email = EXCLUDED.email,
        email_verified = EXCLUDED.email_verified,
        email_confirmed_at = EXCLUDED.email_confirmed_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_from_auth_user();

DROP TRIGGER IF EXISTS on_auth_user_updated_profile ON auth.users;
CREATE TRIGGER on_auth_user_updated_profile
  AFTER UPDATE OF email, email_confirmed_at, confirmed_at, raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_from_auth_user();

-- 기존 가입 회원 backfill
INSERT INTO public.profiles (id, display_name, email, email_verified, email_confirmed_at)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'display_name', ''),
  COALESCE(u.email, ''),
  COALESCE(u.email_confirmed_at, u.confirmed_at) IS NOT NULL,
  COALESCE(u.email_confirmed_at, u.confirmed_at)
FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), public.profiles.display_name),
      email = EXCLUDED.email,
      email_verified = EXCLUDED.email_verified,
      email_confirmed_at = EXCLUDED.email_confirmed_at;
