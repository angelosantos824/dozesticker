BEGIN;

CREATE TABLE IF NOT EXISTS dozesticker.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  cta_label text,
  destination_url text,
  whatsapp text,
  phone text,
  address text,
  latitude numeric,
  longitude numeric,
  google_maps_url text,
  apple_maps_url text,
  status text NOT NULL DEFAULT 'draft',
  display_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ads_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT ads_status_check CHECK (status IN ('draft', 'active', 'inactive', 'expired')),
  CONSTRAINT ads_period_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

COMMENT ON TABLE dozesticker.ads IS
  'Public partner announcements for DOZESTICKER, administered only by platform admins.';

CREATE INDEX IF NOT EXISTS ads_active_order_idx
  ON dozesticker.ads (status, display_order, starts_at, ends_at);

DROP TRIGGER IF EXISTS ads_touch_updated_at ON dozesticker.ads;
CREATE TRIGGER ads_touch_updated_at
  BEFORE UPDATE ON dozesticker.ads
  FOR EACH ROW
  EXECUTE FUNCTION dozesticker.touch_updated_at();

ALTER TABLE dozesticker.ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read active ads" ON dozesticker.ads;
CREATE POLICY "Read active ads"
  ON dozesticker.ads
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'active'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

DROP POLICY IF EXISTS "Admins manage ads" ON dozesticker.ads;
CREATE POLICY "Admins manage ads"
  ON dozesticker.ads
  FOR ALL
  TO authenticated
  USING (dozesticker.is_platform_admin())
  WITH CHECK (dozesticker.is_platform_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dozesticker-ads',
  'dozesticker-ads',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read dozesticker ads images" ON storage.objects;
CREATE POLICY "Public read dozesticker ads images"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'dozesticker-ads');

DROP POLICY IF EXISTS "Admins manage dozesticker ads images" ON storage.objects;
CREATE POLICY "Admins manage dozesticker ads images"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'dozesticker-ads' AND dozesticker.is_platform_admin())
  WITH CHECK (bucket_id = 'dozesticker-ads' AND dozesticker.is_platform_admin());

GRANT SELECT ON dozesticker.ads TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dozesticker.ads TO authenticated;

COMMIT;
