import { getSession, signOut } from "../services/auth.service.js";

const privateItems = [
  { id: "dashboard", label: "Dashboard", href: "dashboard.html", icon: "DB", mobile: true },
  { id: "album", label: "Album", href: "album.html", icon: "AL", mobile: true },
  { id: "feira", label: "Feira", href: "feira.html", icon: "FR", mobile: true },
  { id: "perfil", label: "Perfil", href: "perfil.html", icon: "PF", mobile: true },
  { id: "admin-anuncios", label: "Anuncios", href: "admin-anuncios.html", icon: "AD", admin: true },
  { id: "sair", label: "Sair", href: "#", icon: "SA", mobile: true, action: "signout" }
];

const publicItems = [
  { id: "login", label: "Entrar", href: "login.html", icon: "EN", mobile: true },
  { id: "cadastro", label: "Criar conta", href: "cadastro.html", icon: "CC", mobile: true }
];

export async function renderNavigation(currentPage) {
  const sidebar = document.querySelector("[data-sidebar]");
  const mobileNav = document.querySelector("[data-mobile-nav]");
  if (!sidebar && !mobileNav) return;

  const session = await getSession().catch(() => null);
  const navItems = session
    ? privateItems.filter((item) => !item.admin || isPlatformAdminSession(session))
    : publicItems;

  if (sidebar) {
    sidebar.innerHTML = `
      <a class="brand" href="${session ? "dashboard.html" : "index.html"}" aria-label="DOZESTICKER">
        <img src="assets/images/brand/dozedev-symbol.png" alt="" width="38" height="38">
        <span>DOZESTICKER <small>by DOZEDEV</small></span>
      </a>
      <nav class="nav-list" aria-label="Navegacao principal">
        ${navItems.map((item) => navLink(item, currentPage, "nav-link")).join("")}
      </nav>
    `;
  }

  if (mobileNav) {
    mobileNav.innerHTML = navItems.filter((item) => item.mobile).map((item) => navLink(item, currentPage, "mobile-nav-link")).join("");
  }

  document.querySelectorAll("[data-nav-action='signout']").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      await signOut();
      window.location.href = "login.html";
    });
  });
}

function isPlatformAdminSession(session) {
  const role = session?.user?.app_metadata?.role;
  const roles = session?.user?.app_metadata?.roles || [];
  return ["admin", "super_admin", "platform_admin"].includes(role)
    || roles.some((item) => ["admin", "super_admin", "platform_admin"].includes(item));
}

function navLink(item, currentPage, className) {
  const current = item.id === currentPage ? ' aria-current="page"' : "";
  const action = item.action ? ` data-nav-action="${item.action}"` : "";
  return `
    <a class="${className}" href="${item.href}"${current}${action}>
      <span class="nav-icon" aria-hidden="true">${item.icon}</span>
      <span>${item.label}</span>
    </a>
  `;
}
