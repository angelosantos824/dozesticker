BEGIN;

-- DOZESTICKER Sprint 02 - database foundation.
-- This migration is designed for the existing DOZEDEV Studio Supabase project.
-- All product-owned objects are created inside the dedicated dozesticker schema.
-- No tables, functions, enums, triggers, views, indexes, policies, procedures or RPCs
-- are created in the public schema.

CREATE SCHEMA IF NOT EXISTS dozesticker;

COMMENT ON SCHEMA dozesticker IS
  'Isolated schema for DOZESTICKER catalog and import foundation.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'dozesticker' AND t.typname = 'collection_status'
  ) THEN
    CREATE TYPE dozesticker.collection_status AS ENUM ('draft', 'active', 'archived');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'dozesticker' AND t.typname = 'album_status'
  ) THEN
    CREATE TYPE dozesticker.album_status AS ENUM ('draft', 'active', 'archived');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'dozesticker' AND t.typname = 'section_status'
  ) THEN
    CREATE TYPE dozesticker.section_status AS ENUM ('active', 'inactive');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'dozesticker' AND t.typname = 'sticker_status'
  ) THEN
    CREATE TYPE dozesticker.sticker_status AS ENUM ('active', 'inactive');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'dozesticker' AND t.typname = 'import_status'
  ) THEN
    CREATE TYPE dozesticker.import_status AS ENUM ('pending', 'processing', 'completed', 'failed');
  END IF;
END $$;

COMMENT ON TYPE dozesticker.collection_status IS
  'Lifecycle for top-level collections: draft, active or archived.';
COMMENT ON TYPE dozesticker.album_status IS
  'Lifecycle for albums: draft, active or archived.';
COMMENT ON TYPE dozesticker.section_status IS
  'Visibility state for album sections: active or inactive.';
COMMENT ON TYPE dozesticker.sticker_status IS
  'Visibility state for catalog stickers: active or inactive.';
COMMENT ON TYPE dozesticker.import_status IS
  'Progress state for future catalog import jobs.';

CREATE OR REPLACE FUNCTION dozesticker.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = dozesticker
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION dozesticker.touch_updated_at() IS
  'Reusable trigger function that keeps updated_at current on mutable catalog tables.';

CREATE OR REPLACE FUNCTION dozesticker.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dozesticker, auth
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'platform_admin')
    OR (auth.jwt() -> 'app_metadata' -> 'roles') ?| ARRAY['admin', 'super_admin', 'platform_admin'],
    false
  );
$$;

COMMENT ON FUNCTION dozesticker.is_platform_admin() IS
  'Checks administrative platform roles from the shared Supabase auth JWT. Review role names against DOZECLIN before applying.';

CREATE TABLE IF NOT EXISTS dozesticker.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  cover_image text,
  year integer,
  status dozesticker.collection_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collections_slug_unique UNIQUE (slug),
  CONSTRAINT collections_slug_not_blank CHECK (length(btrim(slug)) > 0),
  CONSTRAINT collections_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT collections_year_check CHECK (year IS NULL OR year >= 1900)
);

COMMENT ON TABLE dozesticker.collections IS
  'Top-level collectible families, such as World Cup, NBA, Pokemon or other album lines.';

CREATE TABLE IF NOT EXISTS dozesticker.albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES dozesticker.collections(id) ON DELETE RESTRICT,
  slug text NOT NULL,
  name text NOT NULL,
  edition text,
  country text,
  language text,
  total_stickers integer NOT NULL DEFAULT 0,
  release_date date,
  status dozesticker.album_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT albums_slug_unique UNIQUE (slug),
  CONSTRAINT albums_slug_not_blank CHECK (length(btrim(slug)) > 0),
  CONSTRAINT albums_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT albums_total_stickers_check CHECK (total_stickers >= 0)
);

COMMENT ON TABLE dozesticker.albums IS
  'Specific album editions that belong to a collection and can contain sections and stickers.';

CREATE TABLE IF NOT EXISTS dozesticker.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES dozesticker.albums(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  status dozesticker.section_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sections_album_slug_unique UNIQUE (album_id, slug),
  CONSTRAINT sections_slug_not_blank CHECK (length(btrim(slug)) > 0),
  CONSTRAINT sections_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT sections_display_order_check CHECK (display_order >= 0)
);

COMMENT ON TABLE dozesticker.sections IS
  'Album divisions such as national teams, shields, stadiums, legends or thematic groups.';

CREATE TABLE IF NOT EXISTS dozesticker.stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES dozesticker.albums(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES dozesticker.sections(id) ON DELETE RESTRICT,
  code text NOT NULL,
  number integer,
  title text NOT NULL,
  subtitle text,
  page integer,
  position integer,
  rarity text,
  image_url text,
  notes text,
  status dozesticker.sticker_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stickers_album_code_unique UNIQUE (album_id, code),
  CONSTRAINT stickers_code_not_blank CHECK (length(btrim(code)) > 0),
  CONSTRAINT stickers_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT stickers_page_check CHECK (page IS NULL OR page >= 0),
  CONSTRAINT stickers_position_check CHECK (position IS NULL OR position >= 0)
);

COMMENT ON TABLE dozesticker.stickers IS
  'Canonical sticker catalog for each album. It does not represent user ownership.';

CREATE TABLE IF NOT EXISTS dozesticker.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES dozesticker.albums(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  processed_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  status dozesticker.import_status NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_jobs_file_name_not_blank CHECK (length(btrim(file_name)) > 0),
  CONSTRAINT import_jobs_total_rows_check CHECK (total_rows >= 0),
  CONSTRAINT import_jobs_processed_rows_check CHECK (processed_rows >= 0),
  CONSTRAINT import_jobs_imported_rows_check CHECK (imported_rows >= 0),
  CONSTRAINT import_jobs_processed_within_total_check CHECK (processed_rows <= total_rows),
  CONSTRAINT import_jobs_imported_within_total_check CHECK (imported_rows <= total_rows),
  CONSTRAINT import_jobs_finished_after_started_check CHECK (
    finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at
  )
);

COMMENT ON TABLE dozesticker.import_jobs IS
  'Audit and progress table for future catalog CSV import routines.';

CREATE INDEX IF NOT EXISTS dozesticker.collections_slug_idx
  ON dozesticker.collections (slug);

CREATE INDEX IF NOT EXISTS dozesticker.albums_collection_id_idx
  ON dozesticker.albums (collection_id);

CREATE INDEX IF NOT EXISTS dozesticker.albums_slug_idx
  ON dozesticker.albums (slug);

CREATE INDEX IF NOT EXISTS dozesticker.sections_album_id_idx
  ON dozesticker.sections (album_id);

CREATE INDEX IF NOT EXISTS dozesticker.sections_display_order_idx
  ON dozesticker.sections (display_order);

CREATE INDEX IF NOT EXISTS dozesticker.stickers_album_id_idx
  ON dozesticker.stickers (album_id);

CREATE INDEX IF NOT EXISTS dozesticker.stickers_section_id_idx
  ON dozesticker.stickers (section_id);

CREATE INDEX IF NOT EXISTS dozesticker.stickers_code_idx
  ON dozesticker.stickers (code);

CREATE INDEX IF NOT EXISTS dozesticker.stickers_number_idx
  ON dozesticker.stickers (number);

CREATE INDEX IF NOT EXISTS dozesticker.stickers_page_idx
  ON dozesticker.stickers (page);

CREATE INDEX IF NOT EXISTS dozesticker.import_jobs_status_idx
  ON dozesticker.import_jobs (status);

DROP TRIGGER IF EXISTS collections_touch_updated_at ON dozesticker.collections;
CREATE TRIGGER collections_touch_updated_at
  BEFORE UPDATE ON dozesticker.collections
  FOR EACH ROW
  EXECUTE FUNCTION dozesticker.touch_updated_at();

DROP TRIGGER IF EXISTS albums_touch_updated_at ON dozesticker.albums;
CREATE TRIGGER albums_touch_updated_at
  BEFORE UPDATE ON dozesticker.albums
  FOR EACH ROW
  EXECUTE FUNCTION dozesticker.touch_updated_at();

DROP TRIGGER IF EXISTS sections_touch_updated_at ON dozesticker.sections;
CREATE TRIGGER sections_touch_updated_at
  BEFORE UPDATE ON dozesticker.sections
  FOR EACH ROW
  EXECUTE FUNCTION dozesticker.touch_updated_at();

DROP TRIGGER IF EXISTS stickers_touch_updated_at ON dozesticker.stickers;
CREATE TRIGGER stickers_touch_updated_at
  BEFORE UPDATE ON dozesticker.stickers
  FOR EACH ROW
  EXECUTE FUNCTION dozesticker.touch_updated_at();

ALTER TABLE dozesticker.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE dozesticker.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE dozesticker.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE dozesticker.stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dozesticker.import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read active collections" ON dozesticker.collections;
CREATE POLICY "Read active collections"
  ON dozesticker.collections
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS "Read active albums" ON dozesticker.albums;
CREATE POLICY "Read active albums"
  ON dozesticker.albums
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM dozesticker.collections c
      WHERE c.id = albums.collection_id
        AND c.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Read active sections" ON dozesticker.sections;
CREATE POLICY "Read active sections"
  ON dozesticker.sections
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM dozesticker.albums a
      JOIN dozesticker.collections c ON c.id = a.collection_id
      WHERE a.id = sections.album_id
        AND a.status = 'active'
        AND c.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Read active stickers" ON dozesticker.stickers;
CREATE POLICY "Read active stickers"
  ON dozesticker.stickers
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM dozesticker.sections s
      JOIN dozesticker.albums a ON a.id = s.album_id
      JOIN dozesticker.collections c ON c.id = a.collection_id
      WHERE s.id = stickers.section_id
        AND s.album_id = stickers.album_id
        AND s.status = 'active'
        AND a.status = 'active'
        AND c.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins manage collections" ON dozesticker.collections;
CREATE POLICY "Admins manage collections"
  ON dozesticker.collections
  FOR ALL
  TO authenticated
  USING (dozesticker.is_platform_admin())
  WITH CHECK (dozesticker.is_platform_admin());

DROP POLICY IF EXISTS "Admins manage albums" ON dozesticker.albums;
CREATE POLICY "Admins manage albums"
  ON dozesticker.albums
  FOR ALL
  TO authenticated
  USING (dozesticker.is_platform_admin())
  WITH CHECK (dozesticker.is_platform_admin());

DROP POLICY IF EXISTS "Admins manage sections" ON dozesticker.sections;
CREATE POLICY "Admins manage sections"
  ON dozesticker.sections
  FOR ALL
  TO authenticated
  USING (dozesticker.is_platform_admin())
  WITH CHECK (dozesticker.is_platform_admin());

DROP POLICY IF EXISTS "Admins manage stickers" ON dozesticker.stickers;
CREATE POLICY "Admins manage stickers"
  ON dozesticker.stickers
  FOR ALL
  TO authenticated
  USING (dozesticker.is_platform_admin())
  WITH CHECK (dozesticker.is_platform_admin());

DROP POLICY IF EXISTS "Admins manage import jobs" ON dozesticker.import_jobs;
CREATE POLICY "Admins manage import jobs"
  ON dozesticker.import_jobs
  FOR ALL
  TO authenticated
  USING (dozesticker.is_platform_admin())
  WITH CHECK (dozesticker.is_platform_admin());

GRANT USAGE ON SCHEMA dozesticker TO anon, authenticated;
GRANT SELECT ON
  dozesticker.collections,
  dozesticker.albums,
  dozesticker.sections,
  dozesticker.stickers
TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  dozesticker.collections,
  dozesticker.albums,
  dozesticker.sections,
  dozesticker.stickers,
  dozesticker.import_jobs
TO authenticated;

COMMIT;
