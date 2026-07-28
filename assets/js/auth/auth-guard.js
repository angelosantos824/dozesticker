import { getCurrentProfile, getSession, signOut } from "../services/auth.service.js";

const publicPages = new Set(["index", "login", "cadastro", "recuperar-senha", "nova-senha"]);
const page = document.body.dataset.page || "";

document.addEventListener("DOMContentLoaded", () => {
  guardRoute();
});

async function guardRoute() {
  let redirecting = false;
  try {
    const session = await getSession();

    if (!session && !publicPages.has(page)) {
      redirecting = true;
      redirectToLogin();
      return;
    }

    if (session && publicPages.has(page) && page !== "nova-senha") {
      redirecting = true;
      window.location.replace("dashboard.html");
      return;
    }

    if (session && !publicPages.has(page) && navigator.onLine) {
      const profile = await getCurrentProfile();
      if (profile?.status === "blocked") {
        await signOut();
        redirecting = true;
        redirectToLogin("blocked");
        return;
      }
    }
  } catch (error) {
    if (!publicPages.has(page)) {
      redirecting = true;
      redirectToLogin("session");
      return;
    }
  } finally {
    if (!redirecting) document.body.classList.remove("auth-pending");
  }
}

function redirectToLogin(reason = "") {
  const next = encodeURIComponent(window.location.pathname.split("/").pop() || "dashboard.html");
  const suffix = reason ? `&reason=${encodeURIComponent(reason)}` : "";
  window.location.replace(`login.html?next=${next}${suffix}`);
}
