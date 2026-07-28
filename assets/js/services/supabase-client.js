import { isSupabaseConfigured, supabaseConfig } from "../config/supabase.js";

let supabaseClient;
let supabaseModulePromise;

export async function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;

  if (!supabaseClient) {
    supabaseModulePromise ||= import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm");
    const { createClient } = await supabaseModulePromise;
    supabaseClient = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      db: {
        schema: supabaseConfig.schema
      }
    });
  }

  return supabaseClient;
}
