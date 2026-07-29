BEGIN;

CREATE OR REPLACE FUNCTION dozesticker.get_admin_user_stats()
RETURNS TABLE (
  total_users bigint,
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
  IF NOT dozesticker.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo nao autorizado';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_users,
    COUNT(*) FILTER (
      WHERE p.created_at >= date_trunc('day', now())
    )::bigint AS registered_today,
    COUNT(*) FILTER (
      WHERE p.created_at >= now() - interval '7 days'
    )::bigint AS registered_last_7_days,
    COUNT(*) FILTER (
      WHERE p.created_at >= now() - interval '30 days'
    )::bigint AS registered_last_30_days,
    MAX(p.created_at) AS last_registration_at
  FROM dozesticker.profiles AS p;
END;
$$;

COMMENT ON FUNCTION dozesticker.get_admin_user_stats() IS
  'Returns aggregate DOZESTICKER user profile statistics for platform administrators only.';

REVOKE ALL
ON FUNCTION dozesticker.get_admin_user_stats()
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION dozesticker.get_admin_user_stats()
TO authenticated;

COMMIT;
