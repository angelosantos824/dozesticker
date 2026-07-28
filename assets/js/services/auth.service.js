import { getSupabaseClient } from "./supabase-client.js";
import { isSupabaseConfigured } from "../config/supabase.js";

const profileFields = "id, full_name, username, avatar_url, status, created_at, updated_at";

export async function signUp({ fullName, email, password }) {
  const supabase = await requireSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName.trim(),
          product_code: "dozesticker"
      }
    }
  });

  if (error) throw translateAuthError(error);
  return data;
}

export async function signIn({ email, password }) {
  const supabase = await requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) throw translateAuthError(error);
  return data;
}

export async function signOut() {
  const supabase = await requireSupabase();
  const { error } = await supabase.auth.signOut();

  if (error) throw translateAuthError(error);
  window.dispatchEvent(new CustomEvent("dozesticker:auth-signed-out"));
}

export async function getSession() {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw translateAuthError(error);
  return data.session;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (session?.user) return session.user;

  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) throw translateAuthError(error);
  return data.user;
}

export async function getCurrentProfile() {
  const supabase = await requireSupabase();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .schema("dozesticker")
    .from("profiles")
    .select(profileFields)
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw translateAuthError(error);
  return data;
}

export async function updateProfile({ fullName, username, avatarUrl }) {
  const supabase = await requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessao expirada. Entre novamente para continuar.");

  const payload = {};
  if (typeof fullName !== "undefined") payload.full_name = fullName;
  if (typeof username !== "undefined") payload.username = username || null;
  if (typeof avatarUrl !== "undefined") payload.avatar_url = avatarUrl || null;

  const { data, error } = await supabase
    .schema("dozesticker")
    .from("profiles")
    .update(payload)
    .eq("id", user.id)
    .select(profileFields)
    .single();

  if (error) throw translateAuthError(error);
  return data;
}

export async function resetPassword(email) {
  const supabase = await requireSupabase();
  const redirectTo = new URL("nova-senha.html", window.location.href).toString();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) throw translateAuthError(error);
  return data;
}

export async function updatePassword(password) {
  const supabase = await requireSupabase();
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) throw translateAuthError(error);
  return data;
}

export async function onAuthStateChange(callback) {
  const supabase = await getSupabaseClient();
  if (!supabase) return { data: { subscription: { unsubscribe() {} } } };
  return supabase.auth.onAuthStateChange(callback);
}

export function isAuthConfigured() {
  return isSupabaseConfigured();
}

async function requireSupabase() {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase nao configurado. Informe URL e anon key do projeto DOZEDEV Studio.");
  }
  return supabase;
}

function translateAuthError(error) {
  const message = String(error?.message || "Erro de autenticacao.");
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return new Error("Email ou senha invalidos.");
  }

  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return new Error("Este email ja possui uma conta.");
  }

  if (normalized.includes("email not confirmed")) {
    return new Error("Confirme seu email antes de entrar.");
  }

  if (normalized.includes("password")) {
    return new Error("A senha informada nao atende aos requisitos.");
  }

  return new Error(message);
}
