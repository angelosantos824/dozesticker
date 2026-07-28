import {
  getCurrentProfile,
  getSession,
  signOut
} from "../services/auth.service.js";

const publicPages = new Set([
  "index",
  "login",
  "cadastro",
  "recuperar-senha",
  "nova-senha"
]);

const page = getCurrentPage();

document.addEventListener("DOMContentLoaded", () => {
  guardRoute();
});

async function guardRoute() {
  let redirecting = false;

  try {
    const session = await getSession();
    const isPublicPage = publicPages.has(page);

    if (!session) {
      if (!isPublicPage) {
        redirecting = true;
        redirectToLogin();
        return;
      }

      return;
    }

    /*
     * Usuário autenticado em tela pública.
     * A página de nova senha precisa permanecer acessível
     * durante o fluxo de recuperação.
     */
    if (isPublicPage && page !== "nova-senha") {
      redirecting = true;
      window.location.replace("dashboard.html");
      return;
    }

    /*
     * Não transformar erro de perfil em erro de sessão.
     * A sessão já foi confirmada acima.
     */
    if (!isPublicPage && navigator.onLine) {
      await validateProfileStatus();
    }
  } catch (error) {
    console.error("Erro durante a proteção da rota:", error);

    /*
     * Não redirecionar automaticamente para login.
     * Um erro no banco, RLS ou perfil não significa
     * necessariamente que a sessão expirou.
     */
    showGuardError(
      "Não foi possível validar seu perfil. Recarregue a página ou tente novamente."
    );
  } finally {
    if (!redirecting) {
      document.body.classList.remove("auth-pending");
    }
  }
}

async function validateProfileStatus() {
  try {
    const profile = await getCurrentProfile();

    /*
     * Perfil inexistente não deve criar loop.
     * Apenas registramos para diagnóstico.
     */
    if (!profile) {
      console.warn(
        "Sessão autenticada, mas nenhum perfil DOZESTICKER foi encontrado."
      );
      return;
    }

    if (profile.status === "blocked") {
      await signOut();
      redirectToLogin("blocked");
    }
  } catch (error) {
    /*
     * Propaga para exibição do erro, mas não faz logout
     * nem redireciona automaticamente.
     */
    throw new Error(
      `Falha ao consultar o perfil DOZESTICKER: ${
        error?.message || "erro desconhecido"
      }`
    );
  }
}

function getCurrentPage() {
  const dataPage = String(document.body?.dataset?.page || "").trim();

  if (dataPage) {
    return dataPage;
  }

  const fileName =
    window.location.pathname.split("/").pop() || "index.html";

  return fileName.replace(/\.html$/i, "");
}

function redirectToLogin(reason = "") {
  const currentFile =
    window.location.pathname.split("/").pop() || "dashboard.html";

  const next = encodeURIComponent(currentFile);
  const suffix = reason
    ? `&reason=${encodeURIComponent(reason)}`
    : "";

  window.location.replace(
    `login.html?next=${next}${suffix}`
  );
}

function showGuardError(message) {
  let element = document.querySelector("[data-auth-guard-error]");

  if (!element) {
    element = document.createElement("div");
    element.dataset.authGuardError = "true";
    element.setAttribute("role", "alert");
    element.className = "auth-guard-error";
    document.body.prepend(element);
  }

  element.textContent = message;
}