import { getSupabaseClient } from "./supabase-client.js";
import { isSupabaseConfigured } from "../config/supabase.js";

const profileFields = "id, full_name, username, avatar_url, status, created_at, updated_at";

export async function signUp({ fullName, email, password }) {
  const supabase = await requireSupabase();
  return handleAuthResponse(() => supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        product_code: "dozesticker"
      }
    }
  }));
}

export async function signIn({ email, password }) {
  const supabase = await requireSupabase();
  return handleAuthResponse(() => supabase.auth.signInWithPassword({ email, password }));
}

export async function signOut() {
  const supabase = await requireSupabase();
  await handleAuthResponse(() => supabase.auth.signOut());

  window.dispatchEvent(new CustomEvent("dozesticker:auth-signed-out"));
}

export async function getSession() {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  const data = await handleAuthResponse(() => supabase.auth.getSession());
  return data.session;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (session?.user) return session.user;

  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  const data = await handleAuthResponse(() => supabase.auth.getUser());
  return data.user;
}

export async function getCurrentProfile() {
  const supabase = await requireSupabase();
  const user = await getCurrentUser();
  if (!user) return null;

  const data = await handleAuthResponse(() => supabase
    .schema("dozesticker")
    .from("profiles")
    .select(profileFields)
    .eq("id", user.id)
    .maybeSingle());
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

  const data = await handleAuthResponse(() => supabase
    .schema("dozesticker")
    .from("profiles")
    .update(payload)
    .eq("id", user.id)
    .select(profileFields)
    .single());
  return data;
}

export async function resetPassword(email) {
  const supabase = await requireSupabase();
  const redirectTo = new URL("nova-senha.html", window.location.href).toString();
  return handleAuthResponse(() => supabase.auth.resetPasswordForEmail(email, { redirectTo }));
}

export async function updatePassword(password) {
  const supabase = await requireSupabase();
  return handleAuthResponse(() => supabase.auth.updateUser({ password }));
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

async function handleAuthResponse(request) {
  try {
    const { data, error } = await request();
    if (error) throw error;
    return data;
  } catch (error) {
    throw translateAuthError(error);
  }
}

function translateAuthError(error) {
  const message = String(error?.message || "Erro de autenticacao.");
  const normalized = message.toLowerCase();

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("load failed") ||
    normalized.includes("cors")
  ) {
    return new Error("Nao foi possivel contactar o Supabase. Confirme a ligacao a internet e permita https://angelosantos824.github.io/dozesticker/** em Auth > URL Configuration no projeto Supabase.");
  }

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
