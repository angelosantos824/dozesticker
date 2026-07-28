BEGIN;

CREATE TABLE IF NOT EXISTS dozesticker.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (length(btrim(full_name)) >= 2),
  username text,
  avatar_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE dozesticker.profiles IS
  'Perfil do usuario DOZESTICKER, isolado no schema dozesticker e vinculado a auth.users.';

COMMENT ON COLUMN dozesticker.profiles.id IS
  'Mesmo id de auth.users. Nao duplicar usuarios entre produtos DOZEDEV.';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON dozesticker.profiles (lower(username))
  WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_status_idx
  ON dozesticker.profiles(status);

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON dozesticker.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON dozesticker.profiles
  FOR EACH ROW
  EXECUTE FUNCTION dozesticker.touch_updated_at();

CREATE OR REPLACE FUNCTION dozesticker.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dozesticker, auth
AS $$
DECLARE
  requested_name text;
BEGIN
  requested_name := NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), '');

  INSERT INTO dozesticker.profiles (id, full_name, status)
  VALUES (
    NEW.id,
    COALESCE(requested_name, NEW.email, 'Colecionador'),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION dozesticker.handle_new_auth_user() IS
  'Cria perfil DOZESTICKER automaticamente ao inserir usuario em auth.users.';

CREATE OR REPLACE FUNCTION dozesticker.prevent_profile_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dozesticker
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Nao e permitido alterar o identificador do perfil.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT dozesticker.is_platform_admin() THEN
    RAISE EXCEPTION 'Nao e permitido alterar o status do perfil.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION dozesticker.prevent_profile_identity_change() IS
  'Impede que usuarios comuns alterem id ou status do proprio perfil.';

DROP TRIGGER IF EXISTS profiles_prevent_identity_change ON dozesticker.profiles;
CREATE TRIGGER profiles_prevent_identity_change
  BEFORE UPDATE ON dozesticker.profiles
  FOR EACH ROW
  EXECUTE FUNCTION dozesticker.prevent_profile_identity_change();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION dozesticker.handle_new_auth_user();

INSERT INTO dozesticker.profiles (id, full_name, status)
SELECT
  users.id,
  COALESCE(NULLIF(btrim(users.raw_user_meta_data->>'full_name'), ''), users.email, 'Colecionador'),
  'active'
FROM auth.users AS users
ON CONFLICT (id) DO NOTHING;

ALTER TABLE dozesticker.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON dozesticker.profiles;
CREATE POLICY "profiles_select_own"
  ON dozesticker.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON dozesticker.profiles;
CREATE POLICY "profiles_update_own"
  ON dozesticker.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin_manage" ON dozesticker.profiles;
CREATE POLICY "profiles_admin_manage"
  ON dozesticker.profiles
  FOR ALL
  TO authenticated
  USING (dozesticker.is_platform_admin())
  WITH CHECK (dozesticker.is_platform_admin());

REVOKE ALL ON dozesticker.profiles FROM anon;
GRANT SELECT, UPDATE ON dozesticker.profiles TO authenticated;

COMMIT;
