import { getSupabaseClient } from "./supabase-client.js";

export async function isPlatformAdmin() {
  try {
    const supabase = await requireSupabase();
    const { data, error } = await supabase
      .schema("dozesticker")
      .rpc("is_platform_admin");

    if (error) {
      console.error("[ADMIN] Falha ao validar administrador", error);
      return false;
    }
    return data === true;
  } catch (error) {
    console.error("[ADMIN] Falha ao validar administrador", error);
    return false;
  }
}

export async function getAdminUserStats() {
  const supabase = await requireSupabase();
  const { data, error } = await supabase
    .schema("dozesticker")
    .rpc("get_admin_user_stats");

  if (error) {
    console.error("[ADMIN] Falha ao carregar estatisticas", error);
    throw error;
  }

  const stats = Array.isArray(data) ? data[0] : data;

  return {
    totalUsers: Number(stats?.total_users || 0),
    activeUsers: Number(stats?.active_users || 0),
    registeredToday: Number(stats?.registered_today || 0),
    registeredLast7Days: Number(stats?.registered_last_7_days || 0),
    registeredLast30Days: Number(stats?.registered_last_30_days || 0),
    lastRegistrationAt: stats?.last_registration_at || null
  };
}

async function requireSupabase() {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase nao configurado.");
  }
  return supabase;
}
