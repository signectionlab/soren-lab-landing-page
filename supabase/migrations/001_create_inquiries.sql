-- SOREN LAB inquiries table + RLS
-- Supabase Dashboard → SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_sheet_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  inquiry_type text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  privacy_agreed boolean NOT NULL DEFAULT false,
  memo text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'landing_page',
  status text NOT NULL DEFAULT 'NEW',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquiries_created_at_idx ON public.inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON public.inquiries (status);
CREATE UNIQUE INDEX IF NOT EXISTS inquiries_legacy_sheet_id_idx
  ON public.inquiries (legacy_sheet_id)
  WHERE legacy_sheet_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_inquiries_updated_at ON public.inquiries;
CREATE TRIGGER update_inquiries_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_inquiries" ON public.inquiries;
CREATE POLICY "anon_insert_inquiries"
  ON public.inquiries
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_inquiries" ON public.inquiries;
CREATE POLICY "auth_select_inquiries"
  ON public.inquiries
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_update_inquiries" ON public.inquiries;
CREATE POLICY "auth_update_inquiries"
  ON public.inquiries
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_inquiries" ON public.inquiries;
CREATE POLICY "auth_delete_inquiries"
  ON public.inquiries
  FOR DELETE
  TO authenticated
  USING (true);
