import { getSession, signOut } from "../services/auth.service.js";

const sidebarStateKey = "dozesticker:sidebar-collapsed";

const privateItems = [
  { id: "dashboard", label: "Dashboard", href: "dashboard.html", mobile: true },
  { id: "album", label: "Album", href: "album.html", mobile: true },
  { id: "feira", label: "Feira", href: "feira.html", mobile: true },
  { id: "perfil", label: "Perfil", href: "perfil.html", mobile: true },
  { id: "admin-anuncios", label: "Anuncios", href: "admin-anuncios.html", admin: true },
  { id: "sair", label: "Sair", href: "#", mobile: true, action: "signout" }
];

const publicItems = [
  { id: "login", label: "Entrar", href: "login.html", mobile: true },
  { id: "cadastro", label: "Criar conta", href: "cadastro.html", mobile: true }
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
    const collapsed = readSidebarCollapsed();
    document.body.classList.toggle("is-sidebar-collapsed", collapsed);
    sidebar.innerHTML = `
      <div class="sidebar-brand-row">
        ${brandLink(session)}
        <button class="sidebar-toggle" type="button" data-sidebar-toggle aria-label="Ocultar menu lateral">Ocultar</button>
      </div>
      <nav class="nav-list" aria-label="Navegacao principal">
        ${navItems.map((item) => navLink(item, currentPage, "nav-link")).join("")}
      </nav>
    `;
    renderCollapsedBrand(session);
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

  document.querySelectorAll("[data-sidebar-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const collapsed = !document.body.classList.contains("is-sidebar-collapsed");
      writeSidebarCollapsed(collapsed);
      document.body.classList.toggle("is-sidebar-collapsed", collapsed);
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
      <span>${item.label}</span>
    </a>
  `;
}

function brandLink(session) {
  return `
    <a class="brand" href="${session ? "dashboard.html" : "index.html"}" aria-label="DOZESTICKER">
      <img src="assets/images/logo/icon.png" alt="" width="38" height="38">
      <span>DOZESTICKER <small>by DOZEDEV</small></span>
    </a>
  `;
}

function renderCollapsedBrand(session) {
  let card = document.querySelector("[data-collapsed-brand]");
  if (!card) {
    card = document.createElement("div");
    card.dataset.collapsedBrand = "true";
    card.className = "collapsed-brand-card";
    document.body.append(card);
  }

  card.innerHTML = `
    <button class="sidebar-toggle collapsed-sidebar-toggle" type="button" data-sidebar-toggle aria-label="Mostrar menu lateral">
      <img src="assets/images/logo/icon.png" alt="" width="28" height="28">
      <span>Menu</span>
    </button>
  `;
}

function readSidebarCollapsed() {
  return localStorage.getItem(sidebarStateKey) === "true";
}

function writeSidebarCollapsed(value) {
  localStorage.setItem(sidebarStateKey, String(value));
}
