BEGIN;

ALTER TABLE dozesticker.ads
ADD COLUMN IF NOT EXISTS venue_name text;

DROP FUNCTION IF EXISTS dozesticker.get_admin_user_stats();

CREATE FUNCTION dozesticker.get_admin_user_stats()
RETURNS TABLE (
  total_users bigint,
  active_users bigint,
  registered_today bigint,
  registered_last_7_days bigint,
  registered_last_30_days bigint,
  last_registration_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_user <> 'postgres'
    AND NOT dozesticker.is_platform_admin()
  THEN
    RAISE EXCEPTION 'Acesso administrativo nao autorizado';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (
      WHERE p.status = 'active'
    )::bigint,
    COUNT(*) FILTER (
      WHERE p.created_at >= date_trunc('day', now())
    )::bigint,
    COUNT(*) FILTER (
      WHERE p.created_at >= now() - interval '7 days'
    )::bigint,
    COUNT(*) FILTER (
      WHERE p.created_at >= now() - interval '30 days'
    )::bigint,
    MAX(p.created_at)
  FROM dozesticker.profiles AS p;
END;
$$;

REVOKE ALL
ON FUNCTION dozesticker.get_admin_user_stats()
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION dozesticker.get_admin_user_stats()
TO authenticated;

COMMIT;