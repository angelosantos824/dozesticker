BEGIN;

-- DOZESTICKER Sprint 03 - user collection foundation.
-- This migration belongs to the existing DOZEDEV Studio Supabase project.
-- All product-owned objects are created inside the dedicated dozesticker schema.
-- No objects are created in the public schema.

CREATE TABLE IF NOT EXISTS dozesticker.user_stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id uuid NOT NULL REFERENCES dozesticker.stickers(id) ON DELETE CASCADE,
  has_sticker boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_stickers_user_sticker_unique UNIQUE (user_id, sticker_id)
);

COMMENT ON TABLE dozesticker.user_stickers IS
  'Minimal per-user sticker ownership table for the Sprint 03 MVP. It tracks only whether the user has a sticker.';

CREATE INDEX IF NOT EXISTS dozesticker.user_stickers_user_id_idx
  ON dozesticker.user_stickers (user_id);

CREATE INDEX IF NOT EXISTS dozesticker.user_stickers_sticker_id_idx
  ON dozesticker.user_stickers (sticker_id);

CREATE INDEX IF NOT EXISTS dozesticker.user_stickers_has_sticker_idx
  ON dozesticker.user_stickers (has_sticker);

DROP TRIGGER IF EXISTS user_stickers_touch_updated_at ON dozesticker.user_stickers;
CREATE TRIGGER user_stickers_touch_updated_at
  BEFORE UPDATE ON dozesticker.user_stickers
  FOR EACH ROW
  EXECUTE FUNCTION dozesticker.touch_updated_at();

ALTER TABLE dozesticker.user_stickers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own stickers" ON dozesticker.user_stickers;
CREATE POLICY "Users read own stickers"
  ON dozesticker.user_stickers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own stickers" ON dozesticker.user_stickers;
CREATE POLICY "Users insert own stickers"
  ON dozesticker.user_stickers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own stickers" ON dozesticker.user_stickers;
CREATE POLICY "Users update own stickers"
  ON dozesticker.user_stickers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own stickers" ON dozesticker.user_stickers;
CREATE POLICY "Users delete own stickers"
  ON dozesticker.user_stickers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage user stickers" ON dozesticker.user_stickers;
CREATE POLICY "Admins manage user stickers"
  ON dozesticker.user_stickers
  FOR ALL
  TO authenticated
  USING (dozesticker.is_platform_admin())
  WITH CHECK (dozesticker.is_platform_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON dozesticker.user_stickers TO authenticated;

COMMIT;
