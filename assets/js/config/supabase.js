export const supabaseConfig = {
  url: "https://crbxqjxpghgfqkibudlz.supabase.co",
  anonKey: "sb_publishable_fIzoLl2_C25e3ZymLbidpA_pciDrE3I",
  enabled: false,
  projectPolicy: "Usar obrigatoriamente o mesmo projeto Supabase do DOZEDEV Studio.",
  schema: "dozesticker",
  authSchema: "auth"
};

export function isSupabaseConfigured() {
  return Boolean(supabaseConfig.enabled && supabaseConfig.url && supabaseConfig.anonKey);
}

export function getSupabaseStatus() {
  return {
    ready: isSupabaseConfigured(),
    message: "Supabase preparado para o projeto existente do DOZEDEV Studio, usando auth.users e o schema dozesticker."
  };
}
