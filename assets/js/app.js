import { renderNavigation } from "./components/navigation.js";
import { bindToastButtons, showToast } from "./components/toast.js";
import { AlbumNavigation } from "./components/AlbumNavigation.js";
import { AdCarousel, openMapMenu } from "./components/AdCard.js";
import { ProgressBar } from "./components/ProgressBar.js";
import { SearchBar } from "./components/SearchBar.js";
import { SectionHeader } from "./components/SectionHeader.js";
import { StickerCard } from "./components/StickerCard.js";
import {
  getCurrentProfile,
  getCurrentUser,
  isAuthConfigured,
  resetPassword,
  signIn,
  signOut,
  signUp,
  updatePassword,
  updateProfile
} from "./services/auth.service.js";
import {
  addRecentSearch,
  getAlbum,
  getConnectionState,
  getRecentSearches,
  getSections,
  getServiceMode,
  getStats,
  getStickers,
  getProgress,
  getSectionProgress,
  listCollection,
  markSticker,
  removeSticker,
  searchStickers,
  toggleSticker
} from "./services/collection.service.js";
import {
  deleteAd,
  getActiveAds,
  getAdminAds,
  saveAd,
  updateAdStatus,
  uploadAdImage
} from "./services/ads.service.js";
import {
  getAdminUserStats,
  isPlatformAdmin
} from "./services/admin.service.js";
import { SECTION_ORDER_MAP } from "./data/world-cup-2026.catalog.js";

const statusLabels = {
  todas: "Todas",
  tenho: "Tenho",
  faltam: "Faltam"
};

const placeholderPages = {
  faltantes: {
    title: "Faltantes",
    description: "Use o Modo Troca para ver somente as figurinhas que ainda faltam.",
    note: "Listas avancadas serao refinadas em Sprints futuras."
  },
  repetidas: {
    title: "Repetidas",
    description: "O MVP nao controla quantidade, estoque ou repetidas.",
    note: "Este modulo pertence a uma Sprint futura."
  },
  pacotes: {
    title: "Pacotinhos",
    description: "Abertura e historico de pacotinhos nao fazem parte do MVP atual.",
    note: "Este modulo sera implementado em uma Sprint futura."
  },
  trocas: {
    title: "Trocas",
    description: "Para a feira, use a tela Modo Troca com pesquisa rapida e um toque para marcar como recebida.",
    note: "Fluxos completos de troca entre pessoas pertencem a Sprints futuras."
  },
  configuracoes: {
    title: "Configuracoes",
    description: "Preferencias, album ativo e integracoes serao ajustados aqui quando a base estiver pronta.",
    note: "Supabase segue preparado para o projeto existente do DOZEDEV Studio."
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page || "dashboard";
  await renderNavigation(page);
  bindToastButtons();
  registerServiceWorker();

  if (page === "login") await renderLogin();
  if (page === "cadastro") await renderSignup();
  if (page === "recuperar-senha") await renderPasswordRecovery();
  if (page === "nova-senha") await renderNewPassword();
  if (page === "perfil") await renderProfile();
  if (page === "dashboard") await renderDashboard();
  if (page === "colecao") await renderCollection();
  if (page === "troca") await renderTradeMode();
  if (page === "feira") await renderFairMode();
  if (page === "album") await renderAlbumPage();
  if (page === "admin-anuncios") await renderAdsAdmin();
  if (placeholderPages[page]) renderPlaceholder(page);
  if (page === "index") renderPublicHome();
  renderDozedevFooter();
});

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

function renderDozedevFooter() {
  if (document.querySelector(".dozedev-footer")) return;
  const container = document.querySelector(".main-content") || document.querySelector(".fair-page");
  if (!container) return;
  container.insertAdjacentHTML("beforeend", `
    <footer class="dozedev-footer">
      Desenvolvido por DOZEDEV &middot; <a href="https://dozedev.pt" target="_blank" rel="noopener noreferrer">dozedev.pt</a>
    </footer>
  `);
}

function renderPublicHome() {
  const adsArea = document.querySelector("[data-public-ads]");
  if (!adsArea) return;

  getActiveAds()
    .then((ads) => {
      const eventAds = ads.filter((ad) => ad.placement === "trade_event");
      adsArea.innerHTML = AdCarousel(eventAds, {
        eyebrow: "Eventos",
        title: "Eventos de troca"
      });
      bindAdMapActions(adsArea, eventAds);
      bindAdFlash(adsArea);
    })
    .catch(() => {
      adsArea.innerHTML = "";
    });
}

function bindAdFlash(root) {
  const flash = root.querySelector("[data-ad-flash]");
  if (!flash) return;

  const slides = [...flash.querySelectorAll("[data-ad-slide]")];
  const dots = [...flash.querySelectorAll("[data-ad-dot]")];
  if (slides.length <= 1) return;

  let activeIndex = 0;
  let timer = null;

  const showSlide = (index) => {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeIndex;
      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", String(!isActive));
    });
    dots.forEach((dot, dotIndex) => {
      dot.setAttribute("aria-pressed", String(dotIndex === activeIndex));
    });
  };

  const start = () => {
    timer = window.setInterval(() => showSlide(activeIndex + 1), 3600);
  };

  const restart = () => {
    if (timer) window.clearInterval(timer);
    start();
  };

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      showSlide(Number(dot.dataset.adDot || 0));
      restart();
    });
  });

  start();
}

async function renderAdsAdmin() {
  const area = document.querySelector("[data-ads-admin]");
  if (!area) return;

  let ads = [];
  let editingAd = null;

  const paint = async () => {
    try {
      ads = await getAdminAds();
      area.innerHTML = adsAdminTemplate(ads, editingAd);
    } catch (error) {
      area.innerHTML = `
        <div class="surface empty-state">
          <div>
            <h2>Acesso restrito</h2>
            <p>Apenas administradores da plataforma podem gerenciar anuncios.</p>
          </div>
        </div>
      `;
    }
  };

  area.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-ad-action]");
    if (!button) return;
    const id = button.dataset.adId;
    const action = button.dataset.adAction;
    const ad = ads.find((item) => item.id === id);

    try {
      if (action === "new") editingAd = null;
      if (action === "new-trade-event") {
        editingAd = {
          placement: "trade_event",
          title: "Evento de troca",
          cta_label: "Participar",
          status: "draft",
          display_order: 0
        };
      }
      if (action === "edit") editingAd = ad;
      if (action === "duplicate") editingAd = { ...ad, id: "", title: `${ad.title} copia`, status: "draft" };
      if (action === "activate") await updateAdStatus(id, "active");
      if (action === "deactivate") await updateAdStatus(id, "inactive");
      if (action === "delete" && window.confirm("Excluir este anuncio?")) await deleteAd(id);
      if (action === "preview") {
        showToast(ad.title || "Anuncio", { duration: 2500 });
      }
      await paint();
    } catch (error) {
      showToast(error.message || "Erro ao atualizar anuncio");
    }
  });

  area.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-ad-form]");
    if (!form) return;
    event.preventDefault();
    const submit = form.querySelector("[type='submit']");
    setLoading(submit, true, "Salvando...");

    try {
      const formData = new FormData(form);
      const file = formData.get("image");
      const imageUrl = file?.size ? await uploadAdImage(file) : formData.get("image_url");
      await saveAd({
        id: formData.get("id"),
        placement: formData.get("placement"),
        title: formData.get("title"),
        description: formData.get("description"),
        image_url: imageUrl,
        cta_label: formData.get("cta_label"),
        destination_url: formData.get("destination_url"),
        whatsapp: formData.get("whatsapp"),
        phone: formData.get("phone"),
        address: formData.get("address"),
        latitude: formData.get("latitude"),
        longitude: formData.get("longitude"),
        google_maps_url: formData.get("google_maps_url"),
        apple_maps_url: formData.get("apple_maps_url"),
        starts_at: formData.get("starts_at"),
        ends_at: formData.get("ends_at"),
        display_order: formData.get("display_order"),
        status: formData.get("status")
      });
      editingAd = null;
      await paint();
      showToast("Anuncio salvo");
    } catch (error) {
      showToast(error.message || "Erro ao salvar anuncio");
    } finally {
      setLoading(submit, false, "Salvar anuncio");
    }
  });

  await paint();
}

async function renderLogin() {
  const form = document.querySelector("[data-login-form]");
  const message = document.querySelector("[data-auth-message]");
  if (!form) return;

  paintAuthNotice(message);
  const params = new URLSearchParams(window.location.search);
  if (params.get("reason") === "blocked") setFormMessage(message, "Conta bloqueada. Fale com o suporte DOZEDEV.", "error");
  if (params.get("reason") === "session") setFormMessage(message, "Sua sessao expirou. Entre novamente.", "error");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("[type='submit']");
    setLoading(submit, true, "Entrando...");

    try {
      const email = form.email.value.trim();
      const password = form.password.value;
      validateEmail(email);
      if (!password) throw new Error("Informe sua senha.");
      await signIn({ email, password });
      window.location.href = params.get("next") || "dashboard.html";
    } catch (error) {
      setFormMessage(message, error.message, "error");
    } finally {
      setLoading(submit, false, "Entrar");
    }
  });
}

async function renderSignup() {
  const form = document.querySelector("[data-signup-form]");
  const message = document.querySelector("[data-auth-message]");
  if (!form) return;

  paintAuthNotice(message);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("[type='submit']");
    setLoading(submit, true, "Criando...");

    try {
      const fullName = form.fullName.value.trim();
      const email = form.email.value.trim();
      const password = form.password.value;
      const confirmPassword = form.confirmPassword.value;

      if (fullName.length < 2) throw new Error("Informe seu nome.");
      validateEmail(email);
      if (password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.");
      if (password !== confirmPassword) throw new Error("A confirmacao precisa ser igual a senha.");

      const data = await signUp({ fullName, email, password });
      form.reset();

      if (data.session) {
        window.location.href = "dashboard.html";
        return;
      }

      setFormMessage(message, "Conta criada. Confirme seu email antes de entrar.", "success");
    } catch (error) {
      setFormMessage(message, error.message, "error");
    } finally {
      setLoading(submit, false, "Criar conta");
    }
  });
}

async function renderPasswordRecovery() {
  const form = document.querySelector("[data-recovery-form]");
  const message = document.querySelector("[data-auth-message]");
  if (!form) return;

  paintAuthNotice(message);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("[type='submit']");
    setLoading(submit, true, "Enviando...");

    try {
      const email = form.email.value.trim();
      validateEmail(email);
      await resetPassword(email);
      setFormMessage(message, "Enviamos as instrucoes para redefinir sua senha.", "success");
    } catch (error) {
      setFormMessage(message, error.message, "error");
    } finally {
      setLoading(submit, false, "Enviar link");
    }
  });
}

async function renderNewPassword() {
  const form = document.querySelector("[data-new-password-form]");
  const message = document.querySelector("[data-auth-message]");
  if (!form) return;

  paintAuthNotice(message);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("[type='submit']");
    setLoading(submit, true, "Salvando...");

    try {
      const password = form.password.value;
      const confirmPassword = form.confirmPassword.value;
      if (password.length < 8) throw new Error("A nova senha deve ter pelo menos 8 caracteres.");
      if (password !== confirmPassword) throw new Error("A confirmacao precisa ser igual a nova senha.");
      await updatePassword(password);
      setFormMessage(message, "Senha atualizada. Voce ja pode entrar.", "success");
      window.setTimeout(() => {
        window.location.href = "login.html";
      }, 900);
    } catch (error) {
      setFormMessage(message, error.message, "error");
    } finally {
      setLoading(submit, false, "Salvar senha");
    }
  });
}

async function renderProfile() {
  const area = document.querySelector("[data-profile-page]");
  if (!area) return;

  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile().catch(() => null)]);
  const name = profile?.full_name || user?.user_metadata?.full_name || "";
  const createdAt = profile?.created_at || user?.created_at;

  area.innerHTML = `
    <header class="page-header">
      <div>
        <p class="eyebrow">Conta</p>
        <h1>Perfil</h1>
      </div>
      <button class="button button-secondary" type="button" data-profile-signout>Sair</button>
    </header>

    <section class="profile-grid">
      <article class="surface profile-summary">
        <span class="profile-avatar" aria-hidden="true">${getInitials(name || user?.email)}</span>
        <div>
          <h2>${escapeHtml(name || "Colecionador")}</h2>
          <p>${escapeHtml(user?.email || "")}</p>
          <p class="muted">Criada em ${formatDate(createdAt)}</p>
        </div>
      </article>

      <form class="surface auth-form" data-profile-form>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Dados publicos</p>
            <h2>Alterar nome</h2>
          </div>
        </div>
        <label class="field">
          <span>Nome</span>
          <input name="fullName" type="text" value="${escapeAttribute(name)}" autocomplete="name" required>
        </label>
        <p class="form-message" data-profile-message></p>
        <button class="button button-primary" type="submit">Salvar nome</button>
      </form>

      <article class="surface auth-form">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Seguranca</p>
            <h2>Redefinir senha</h2>
          </div>
        </div>
        <p class="muted">Enviaremos um link para ${escapeHtml(user?.email || "seu email")}.</p>
        <button class="button button-secondary" type="button" data-profile-reset>Enviar link</button>
        <p class="form-message" data-profile-reset-message></p>
      </article>
    </section>
  `;

  area.querySelector("[data-profile-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = area.querySelector("[data-profile-message]");
    const submit = form.querySelector("[type='submit']");
    setLoading(submit, true, "Salvando...");

    try {
      const fullName = form.fullName.value.trim();
      if (fullName.length < 2) throw new Error("Informe seu nome.");
      await updateProfile({ fullName });
      setFormMessage(message, "Nome atualizado.", "success");
      await renderNavigation("perfil");
    } catch (error) {
      setFormMessage(message, error.message, "error");
    } finally {
      setLoading(submit, false, "Salvar nome");
    }
  });

  area.querySelector("[data-profile-reset]").addEventListener("click", async (event) => {
    const message = area.querySelector("[data-profile-reset-message]");
    setLoading(event.currentTarget, true, "Enviando...");

    try {
      await resetPassword(user.email);
      setFormMessage(message, "Link de redefinicao enviado.", "success");
    } catch (error) {
      setFormMessage(message, error.message, "error");
    } finally {
      setLoading(event.currentTarget, false, "Enviar link");
    }
  });

  area.querySelector("[data-profile-signout]").addEventListener("click", async () => {
    await signOut();
    window.location.href = "login.html";
  });
}

async function renderDashboard() {
  const stats = await getStats();
  const albumSelect = document.querySelector("[data-album-select]");
  if (albumSelect) {
    albumSelect.innerHTML = `<option>Copa do Mundo 2026</option>`;
  }

  document.querySelector("[data-dashboard-stats]").innerHTML = [
    ["Tenho", stats.have, "figurinhas marcadas"],
    ["Faltam", stats.missing, "para completar"],
    ["Total", stats.total, "figurinhas no catalogo"],
    ["Percentual", `${stats.progress}%`, "do album completo"]
  ].map(([label, value, note]) => `
    <article class="surface stat-card">
      <span class="stat-label">${label}</span>
      <strong class="stat-value">${value}</strong>
      <span class="stat-note">${note}</span>
    </article>
  `).join("");

  document.querySelector("[data-dashboard-progress]").innerHTML = ProgressBar(stats.progress);
  document.querySelector("[data-dashboard-progress-label]").textContent = `${stats.progress}%`;
  document.querySelector("[data-team-progress]").innerHTML = stats.bySection.map((team) => `
    <div class="team-row">
      <div class="team-row-header"><strong>${team.name}</strong><span class="muted">${team.have} de ${team.total}</span></div>
      ${ProgressBar(team.progress)}
    </div>
  `).join("");

  const latest = (await listCollection({ status: "tenho" })).slice(0, 4);
  document.querySelector("[data-recent-stickers]").innerHTML = latest.length
    ? latest.map((item) => `
      <div class="recent-row">
        <span><strong>${item.code}</strong> <span class="muted">${item.title}</span></span>
        <span class="badge badge-owned">Tenho</span>
      </div>
    `).join("")
    : emptyMessage("Nenhuma figurinha marcada", "Marque suas primeiras figurinhas em Minha colecao ou no Modo Troca.");

  document.querySelector("[data-collection-summary]").innerHTML = [
    ["Album ativo", "Copa do Mundo 2026"],
    ["Fonte dos dados", getServiceMode() === "supabase" ? "Supabase" : "Armazenamento local"],
    ["Fluxo atual", "Tenho / Faltam"],
    ["Modo recomendado", "Feira"]
  ].map(([label, value]) => `
    <div class="summary-row">
      <span class="muted">${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");

  await renderAdminOverview();
}

async function renderAdminOverview() {
  const statsGrid = document.querySelector("[data-dashboard-stats]");
  if (!statsGrid) return;

  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) return;

  statsGrid.insertAdjacentHTML("afterend", adminOverviewTemplate());
  const overview = document.querySelector("[data-admin-overview]");
  const status = overview.querySelector("[data-admin-status]");

  try {
    const stats = await getAdminUserStats();
    overview.querySelector("[data-total-users]").textContent = formatNumber(stats.totalUsers);
    overview.querySelector("[data-users-today]").textContent = formatNumber(stats.registeredToday);
    overview.querySelector("[data-users-seven-days]").textContent = formatNumber(stats.registeredLast7Days);
    overview.querySelector("[data-users-thirty-days]").textContent = formatNumber(stats.registeredLast30Days);
    overview.querySelector("[data-last-registration]").textContent = stats.lastRegistrationAt
      ? `Ultimo cadastro: ${formatDateTime(stats.lastRegistrationAt)}`
      : "0 utilizadores cadastrados";
    status.textContent = "";
    overview.classList.remove("is-loading");
  } catch (error) {
    overview.classList.remove("is-loading");
    overview.classList.add("has-error");
    status.textContent = "Nao foi possivel carregar as estatisticas administrativas.";
  }
}

function adminOverviewTemplate() {
  return `
    <section class="admin-overview is-loading" data-admin-overview>
      <header class="section-heading">
        <div>
          <p class="eyebrow">Super Admin</p>
          <h2>Visao administrativa</h2>
        </div>
      </header>
      <p class="admin-status" data-admin-status>Carregando estatisticas...</p>
      <div class="admin-stats-grid">
        <article class="admin-stat-card admin-stat-card--primary">
          <span>Utilizadores cadastrados</span>
          <strong data-total-users>0</strong>
        </article>
        <article class="admin-stat-card">
          <span>Cadastros hoje</span>
          <strong data-users-today>0</strong>
        </article>
        <article class="admin-stat-card">
          <span>Ultimos 7 dias</span>
          <strong data-users-seven-days>0</strong>
        </article>
        <article class="admin-stat-card">
          <span>Ultimos 30 dias</span>
          <strong data-users-thirty-days>0</strong>
        </article>
      </div>
      <p class="admin-last-registration" data-last-registration></p>
    </section>
  `;
}

async function renderCollection() {
  const grid = document.querySelector("[data-sticker-grid]");
  const search = document.querySelector("[data-sticker-search]");
  const section = document.querySelector("[data-section-filter]");
  const filters = document.querySelector("[data-status-filters]");
  const sections = await getSections();
  let activeStatus = "todas";

  section.innerHTML = [
    `<option value="">Todas as secoes</option>`,
    ...sections.map((item) => `<option value="${item.id}">${item.name}</option>`)
  ].join("");
  filters.innerHTML = Object.entries(statusLabels).map(([value, label]) => `
    <button class="filter-tab" type="button" data-status="${value}" aria-pressed="${value === activeStatus}">${label}</button>
  `).join("");

  const paint = async () => {
    const items = await listCollection({
      query: search.value,
      sectionId: section.value,
      status: activeStatus
    });
    const progressItems = await listCollection({ sectionId: section.value });
    grid.innerHTML = items.length
      ? renderGroupedStickerSections(items, sections, stickerCard, "collection", progressItems)
      : emptyMessage("Nenhuma figurinha encontrada", "Ajuste a pesquisa ou os filtros para continuar.");
  };

  filters.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-status]");
    if (!button) return;
    activeStatus = button.dataset.status;
    filters.querySelectorAll("[data-status]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    await paint();
  });

  grid.addEventListener("click", async (event) => {
    if (handleGroupJump(event)) return;
    const button = event.target.closest("[data-sticker-id]");
    if (!button) return;
    const stickerId = button.dataset.stickerId;
    const nextValue = button.dataset.hasSticker !== "true";

    if (nextValue) {
      await markSticker(stickerId);
      showToast("Figurinha adicionada", {
        actionLabel: "Desfazer",
        duration: 5000,
        onAction: async () => {
          await removeSticker(stickerId);
          await paint();
        }
      });
    } else {
      await removeSticker(stickerId);
      showToast("Figurinha removida");
    }

    await paint();
  });

  search.addEventListener("input", paint);
  section.addEventListener("change", paint);
  await paint();
}

async function renderTradeMode() {
  const list = document.querySelector("[data-trade-list]");
  const search = document.querySelector("[data-trade-search]");
  const statsArea = document.querySelector("[data-trade-stats]");
  const sections = await getSections();

  const paint = async () => {
    const stats = await getStats();
    statsArea.innerHTML = compactStats(stats);
    const items = await listCollection({ query: search.value, status: "faltam" });
    const progressItems = await listCollection();
    list.innerHTML = items.length
      ? renderGroupedStickerSections(items, sections, tradeCard, "trade", progressItems)
      : emptyMessage("Nada faltando aqui", "Limpe a pesquisa ou confira se o album ja esta completo.");
  };

  list.addEventListener("click", async (event) => {
    if (handleGroupJump(event)) return;
    const button = event.target.closest("[data-sticker-id]");
    if (!button) return;
    const stickerId = button.dataset.stickerId;
    await markSticker(stickerId);
    await paint();
    showToast("Recebida", {
      actionLabel: "Desfazer",
      duration: 5000,
      onAction: async () => {
        await removeSticker(stickerId);
        await paint();
      }
    });
  });

  search.addEventListener("input", paint);
  await paint();
}

async function renderFairMode() {
  const list = document.querySelector("[data-fair-list]");
  const search = document.querySelector("[data-fair-search]");
  const statsArea = document.querySelector("[data-fair-stats]");
  const statusArea = document.querySelector("[data-sync-status]");
  const recentArea = document.querySelector("[data-recent-searches]");
  const fullscreenButton = document.querySelector("[data-fair-fullscreen]");
  const backButton = document.querySelector("[data-fair-back]");
  const sections = await getSections();
  let currentItems = [];
  let syncMessage = "";

  const paintStatus = () => {
    const state = getConnectionState();
    statusArea.innerHTML = `
      <span class="connection-dot ${state.online ? "is-online" : "is-offline"}" aria-hidden="true"></span>
      <span>${state.label}${state.pending ? ` · ${state.pending} pendente${state.pending > 1 ? "s" : ""}` : ""}</span>
    `;
  };

  const paintRecent = () => {
    const searches = getRecentSearches();
    recentArea.innerHTML = searches.length
      ? searches.map((item) => `<button class="recent-search" type="button" data-recent-query="${escapeAttribute(item)}">${escapeHtml(item)}</button>`).join("")
      : "";
  };

  const paint = async () => {
    const stats = await getStats();
    statsArea.innerHTML = compactStats(stats);
    currentItems = await listCollection({ query: search.value, status: "faltam" });
    const progressItems = await listCollection();
    list.innerHTML = currentItems.length
      ? renderGroupedStickerSections(currentItems, sections, fairCard, "fair", progressItems)
      : emptyMessage("Nenhuma faltante encontrada", "Limpe a pesquisa para voltar para a lista completa de faltantes.");
    paintStatus();
    paintRecent();
  };

  const receiveSticker = async (stickerId) => {
    const card = list.querySelector(`[data-sticker-id="${stickerId}"]`);
    card?.classList.add("is-leaving");
    await markSticker(stickerId);
    addRecentSearch(search.value);
    window.setTimeout(async () => {
      await paint();
      showToast("Figurinha adicionada", {
        actionLabel: "Desfazer",
        duration: 5000,
        onAction: async () => {
          await removeSticker(stickerId);
          await paint();
        }
      });
    }, 140);
  };

  list.addEventListener("click", async (event) => {
    if (handleGroupJump(event)) return;
    const button = event.target.closest("[data-sticker-id]");
    if (!button) return;
    await receiveSticker(button.dataset.stickerId);
  });

  recentArea.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-recent-query]");
    if (!button) return;
    search.value = button.dataset.recentQuery;
    search.focus();
    await paint();
  });

  fullscreenButton.addEventListener("click", () => {
    document.body.classList.toggle("fair-fullscreen");
    fullscreenButton.textContent = document.body.classList.contains("fair-fullscreen") ? "Sair" : "Modo Feira";
    search.focus();
  });

  backButton?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "album.html";
  });

  search.addEventListener("input", paint);
  search.addEventListener("keydown", async (event) => {
    if (event.key === "Escape") {
      search.value = "";
      await paint();
      return;
    }

    if (event.key === "Enter" && currentItems.length) {
      event.preventDefault();
      await receiveSticker(currentItems[0].id);
    }
  });

  window.addEventListener("online", paint);
  window.addEventListener("offline", paintStatus);
  window.addEventListener("dozesticker:sync-status", (event) => {
    syncMessage = event.detail?.message || "";
    if (!syncMessage) {
      paintStatus();
      return;
    }

    const state = getConnectionState();
    statusArea.innerHTML = `
      <span class="connection-dot ${state.online ? "is-online" : "is-offline"}" aria-hidden="true"></span>
      <span>${syncMessage}</span>
    `;

    window.setTimeout(() => {
      if (syncMessage === event.detail?.message) {
        syncMessage = "";
        paintStatus();
      }
    }, 2600);
  });

  search.focus();
  await paint();
}

async function renderAlbumPage() {
  const album = await getAlbum();
  const sections = await getSections(album.id);
  const shell = document.querySelector("[data-album-shell]");
  const nav = document.querySelector("[data-album-navigation]");
  const header = document.querySelector("[data-album-section-header]");
  const grid = document.querySelector("[data-album-grid]");
  const statsArea = document.querySelector("[data-album-stats]");
  const filters = document.querySelector("[data-album-filters]");
  let activeSectionId = "";
  let activeStatus = "todas";
  let activeType = "todos";

  shell.querySelector("[data-album-title]").textContent = album.name;
  shell.querySelector("[data-album-search-wrap]").innerHTML = SearchBar();
  const search = shell.querySelector("[data-album-search]");

  const renderFilters = () => {
    const filtersData = [
      ["todas", "Todas"],
      ["tenho", "Tenho"],
      ["faltam", "Faltam"],
      ["especiais", "Especiais"],
      ["metalizadas", "Metalizadas"],
      ["time", "Time"]
    ];

    filters.innerHTML = `
      <div class="filter-tabs" role="group" aria-label="Filtros do album">
        ${filtersData.map(([value, label]) => `
          <button class="filter-tab" type="button" data-album-status="${value}" aria-pressed="${value === activeStatus}">${label}</button>
        `).join("")}
      </div>
      <label class="field album-type-filter">
        <span>Tipo</span>
        <select data-album-type>
          <option value="todos">Todos</option>
          <option value="player">Jogador</option>
          <option value="goalkeeper">Goleiro</option>
          <option value="team_photo">Time</option>
          <option value="logo">Logo</option>
          <option value="badge">Escudo</option>
          <option value="stadium">Estadio</option>
          <option value="mascot">Mascote</option>
          <option value="trophy">Trofeu</option>
          <option value="poster">Poster</option>
          <option value="special">Especial</option>
          <option value="promo">Promo</option>
        </select>
      </label>
    `;
    filters.querySelector("[data-album-type]").value = activeType;
  };

  const paint = async () => {
    nav.innerHTML = AlbumNavigation(sections, activeSectionId);
    renderFilters();
    const progress = activeSectionId ? await getSectionProgress(activeSectionId) : await getProgress();
    const title = activeSectionId ? sections.find((item) => item.id === activeSectionId)?.name || "Secao" : "Colecao";
    header.innerHTML = SectionHeader(title, progress);

    const items = await searchStickers(search.value, {
      sectionId: activeSectionId,
      status: activeStatus,
      type: activeType
    });
    const progressItems = await listCollection({ sectionId: activeSectionId });
    const allStats = await getProgress();
    statsArea.innerHTML = albumStats(allStats);
    grid.innerHTML = items.length
      ? renderGroupedStickerSections(items, sections, StickerCard, "album", progressItems)
      : emptyMessage("Nenhuma figurinha encontrada", "Ajuste a pesquisa, secao ou filtros.");
  };

  nav.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-section-id]");
    if (!button) return;
    activeSectionId = button.dataset.sectionId;
    await paint();
  });

  filters.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-album-status]");
    if (!button) return;
    activeStatus = button.dataset.albumStatus;
    await paint();
  });

  filters.addEventListener("change", async (event) => {
    if (!event.target.matches("[data-album-type]")) return;
    activeType = event.target.value;
    await paint();
  });

  grid.addEventListener("click", async (event) => {
    if (handleGroupJump(event)) return;
    const button = event.target.closest("[data-sticker-id]");
    if (!button) return;
    const stickerId = button.dataset.stickerId;
    const nextValue = button.dataset.hasSticker !== "true";
    button.disabled = true;
    try {
      await toggleSticker(stickerId, nextValue);
      await paint();
      showToast(nextValue ? "Figurinha adicionada" : "Figurinha removida", {
        actionLabel: "Desfazer",
        duration: 5000,
        onAction: async () => {
          if (nextValue) {
            await removeSticker(stickerId);
          } else {
            await markSticker(stickerId);
          }
          await paint();
        }
      });
    } finally {
      if (button.isConnected) {
        button.disabled = false;
      }
    }
  });

  search.addEventListener("input", paint);
  window.addEventListener("dozesticker:collection-change", paint);
  await paint();
}

function stickerCard(sticker) {
  return `
    <article class="surface sticker-card ${sticker.hasSticker ? "is-owned" : "is-missing"}">
      <div class="sticker-code"><span>${sticker.code}</span><span>#${sticker.number}</span></div>
      <h2>${sticker.title}</h2>
      <div class="sticker-meta">
        <span>Secao: <strong>${sticker.section_name}</strong></span>
        <span>Pagina ${sticker.page || "-"} &middot; Posicao ${sticker.position || "-"}</span>
        <span class="badge ${sticker.hasSticker ? "badge-owned" : "badge-missing"}">${sticker.hasSticker ? "Tenho" : "Ainda nao tenho"}</span>
      </div>
      <button class="button ${sticker.hasSticker ? "button-secondary" : "button-primary"}" type="button" data-sticker-id="${sticker.id}" data-has-sticker="${sticker.hasSticker}">
        ${sticker.hasSticker ? "Tenho" : "Adicionar"}
      </button>
    </article>
  `;
}

function tradeCard(sticker) {
  return `
    <button class="trade-card surface" type="button" data-sticker-id="${sticker.id}">
      <span class="trade-code">${sticker.code}</span>
      <span>
        <strong>${sticker.title}</strong>
        <small>${sticker.section_name} &middot; #${sticker.number}</small>
      </span>
      <span class="badge badge-missing">Ainda preciso</span>
    </button>
  `;
}

function fairCard(sticker) {
  return `
    <button class="fair-item" type="button" data-sticker-id="${sticker.id}">
      <span class="fair-code">${sticker.code}</span>
      <span class="fair-info">
        <strong>${sticker.title}</strong>
        <small>${sticker.section_name}${sticker.rarity ? ` &middot; ${sticker.rarity}` : ""}</small>
      </span>
      <span class="fair-action">Receber</span>
    </button>
  `;
}

function compactStats(stats) {
  return `
    <article class="surface mini-stat"><span>Tenho</span><strong>${stats.have}</strong></article>
    <article class="surface mini-stat"><span>Faltam</span><strong>${stats.missing}</strong></article>
    <article class="surface mini-stat"><span>Progresso</span><strong>${stats.progress}%</strong></article>
  `;
}

function albumStats(stats) {
  return `
    <article class="surface mini-stat"><span>Total</span><strong>${stats.total}</strong></article>
    <article class="surface mini-stat"><span>Tenho</span><strong>${stats.have}</strong></article>
    <article class="surface mini-stat"><span>Faltam</span><strong>${stats.missing}</strong></article>
    <article class="surface mini-stat"><span>%</span><strong>${stats.progress}%</strong></article>
    <article class="surface mini-stat"><span>Duplicadas</span><strong>${stats.duplicates}</strong></article>
  `;
}

function adsAdminTemplate(ads, editingAd) {
  const ad = editingAd || {};
  return `
    <header class="page-header">
      <div>
        <p class="eyebrow">Administracao</p>
        <h1>Anuncios</h1>
      </div>
      <div class="actions-row">
        <button class="button button-primary" type="button" data-ad-action="new-trade-event">Novo evento de troca</button>
        <button class="button button-secondary" type="button" data-ad-action="new">Novo anuncio</button>
      </div>
    </header>

    <section class="admin-ads-grid">
      <form class="surface admin-ad-form" data-ad-form>
        <input type="hidden" name="id" value="${escapeAttribute(ad.id || "")}">
        <div class="section-heading">
          <div>
            <p class="eyebrow">${ad.id ? "Editar" : "Novo"}</p>
            <h2>${ad.placement === "trade_event" ? "Evento de troca" : "Anuncio"}</h2>
          </div>
        </div>
        <label class="field">
          <span>Local do anuncio</span>
          <select name="placement">
            ${[
              ["public_home", "Pagina publica"],
              ["trade_event", "Evento de troca"],
              ["dashboard", "Dashboard"]
            ].map(([value, label]) => `<option value="${value}" ${value === (ad.placement || "public_home") ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        ${adField("Titulo", "title", ad.title, "text", true)}
        <label class="field"><span>Descricao</span><textarea name="description">${escapeHtml(ad.description || "")}</textarea></label>
        ${adField("Imagem atual", "image_url", ad.image_url, "url")}
        <label class="field"><span>Nova imagem</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label>
        ${adField("Texto do botao", "cta_label", ad.cta_label)}
        ${adField("Link externo", "destination_url", ad.destination_url, "url")}
        ${adField("WhatsApp", "whatsapp", ad.whatsapp)}
        ${adField("Telefone", "phone", ad.phone)}
        ${adField("Endereco", "address", ad.address)}
        <div class="admin-form-pair">
          ${adField("Latitude", "latitude", ad.latitude, "number")}
          ${adField("Longitude", "longitude", ad.longitude, "number")}
        </div>
        ${adField("Google Maps", "google_maps_url", ad.google_maps_url, "url")}
        ${adField("Apple Maps", "apple_maps_url", ad.apple_maps_url, "url")}
        <div class="admin-form-pair">
          ${adField("Inicio", "starts_at", toDateTimeLocal(ad.starts_at), "datetime-local")}
          ${adField("Fim", "ends_at", toDateTimeLocal(ad.ends_at), "datetime-local")}
        </div>
        <div class="admin-form-pair">
          ${adField("Ordem", "display_order", ad.display_order ?? 0, "number")}
          <label class="field">
            <span>Status</span>
            <select name="status">
              ${["draft", "active", "inactive", "expired"].map((status) => `<option value="${status}" ${status === (ad.status || "draft") ? "selected" : ""}>${status}</option>`).join("")}
            </select>
          </label>
        </div>
        <button class="button button-primary" type="submit">Salvar anuncio</button>
      </form>

      <section class="admin-ad-list" aria-label="Anuncios cadastrados">
        ${ads.length ? ads.map(adminAdRow).join("") : emptyMessage("Nenhum anuncio", "Crie o primeiro anuncio para exibir na pagina publica.")}
      </section>
    </section>
  `;
}

function adField(label, name, value = "", type = "text", required = false) {
  return `
    <label class="field">
      <span>${label}</span>
      <input name="${name}" type="${type}" value="${escapeAttribute(value ?? "")}" ${required ? "required" : ""}>
    </label>
  `;
}

function adminAdRow(ad) {
  return `
    <article class="surface admin-ad-row">
      <div class="admin-ad-thumb">${ad.image_url ? `<img src="${escapeAttribute(ad.image_url)}" alt="" loading="lazy">` : "12"}</div>
      <div>
        <h2>${escapeHtml(ad.title)}</h2>
        <p class="muted">${placementLabel(ad.placement)} · ${escapeHtml(ad.status)} · ordem ${Number(ad.display_order || 0)}</p>
        <p class="muted">${formatDate(ad.starts_at)} - ${formatDate(ad.ends_at)}</p>
      </div>
      <div class="admin-ad-actions">
        <button class="button button-secondary" type="button" data-ad-action="edit" data-ad-id="${escapeAttribute(ad.id)}">Editar</button>
        <button class="button button-secondary" type="button" data-ad-action="${ad.status === "active" ? "deactivate" : "activate"}" data-ad-id="${escapeAttribute(ad.id)}">${ad.status === "active" ? "Desativar" : "Ativar"}</button>
        <button class="button button-secondary" type="button" data-ad-action="duplicate" data-ad-id="${escapeAttribute(ad.id)}">Duplicar</button>
        <button class="button button-secondary" type="button" data-ad-action="preview" data-ad-id="${escapeAttribute(ad.id)}">Pre-visualizar</button>
        <button class="button button-secondary" type="button" data-ad-action="delete" data-ad-id="${escapeAttribute(ad.id)}">Excluir</button>
      </div>
    </article>
  `;
}

function placementLabel(placement) {
  const labels = {
    public_home: "Pagina publica",
    trade_event: "Evento de troca",
    dashboard: "Dashboard"
  };
  return labels[placement] || "Pagina publica";
}

function bindAdMapActions(root, ads) {
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-map-ad]");
    const close = event.target.closest("[data-close-map]");
    const copy = event.target.closest("[data-copy-address]");

    if (button) {
      const ad = ads.find((item) => item.id === button.dataset.mapAd);
      if (!ad) return;
      root.insertAdjacentHTML("beforeend", openMapMenu(ad));
    }

    if (close) {
      close.closest("[data-map-modal]")?.remove();
    }

    if (copy) {
      await navigator.clipboard?.writeText(copy.dataset.copyAddress || "");
      showToast("Endereco copiado");
    }
  });
}

function toDateTimeLocal(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}

function renderGroupedStickerSections(items, sections, cardRenderer, variant, progressItems = items) {
  const groups = buildStickerGroups(items, sections, progressItems);

  return `
    ${groupQuickNav(groups, variant)}
    <div class="sticker-section-stack ${variant === "fair" ? "is-fair" : ""}">
      ${groups.map((group) => `
        <section class="sticker-section" id="${group.domId}">
          <header class="sticker-section-header">
            <div class="sticker-section-title">
              <span class="sticker-section-flag" aria-hidden="true">${group.flag}</span>
              <div>
                <h2>${escapeHtml(group.name)}</h2>
                <p>${group.have} de ${group.total} figurinhas</p>
              </div>
            </div>
            <div class="sticker-section-progress">
              <strong>${group.progress}%</strong>
              ${ProgressBar(group.progress)}
            </div>
          </header>
          <div class="${variant === "collection" || variant === "album" ? "sticker-section-grid" : "sticker-section-list"}">
            ${group.items.map(cardRenderer).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function buildStickerGroups(items, sections, progressItems) {
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  const progressBySection = new Map();

  progressItems.forEach((item) => {
    const sectionId = getStickerSectionId(item);
    const current = progressBySection.get(sectionId) || { have: 0, total: 0 };
    current.total += 1;
    if (item.hasSticker) current.have += 1;
    progressBySection.set(sectionId, current);
  });

  const groups = new Map();

  items.forEach((item) => {
    const sectionId = getStickerSectionId(item);
    const section = sectionsById.get(sectionId) || createVirtualSection(item, sectionId);
    const key = section.id;

    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        domId: groupDomId(key),
        name: section.name || item.section_name || item.teamName || item.team_code || "Secao",
        code: section.team_code || section.code || item.team_code || item.teamCode || item.code,
        kind: section.kind || (item.team_code ? "team" : "special"),
        displayOrder: getOfficialSectionOrder(section, item),
        items: []
      });
    }

    groups.get(key).items.push(item);
  });

  return [...groups.values()]
    .map((group) => {
      const progress = progressBySection.get(group.id) || {
        have: group.items.filter((item) => item.hasSticker).length,
        total: group.items.length
      };

      group.items.sort(compareStickers);
      return {
        ...group,
        flag: getSectionFlag(group),
        have: progress.have,
        total: progress.total,
        progress: progress.total ? Math.round((progress.have / progress.total) * 100) : 0
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

function groupQuickNav(groups, variant) {
  return `
    <nav class="sticker-section-nav ${variant === "fair" ? "is-fair" : ""}" aria-label="Navegacao rapida por selecao">
      ${groups.map((group) => `
        <button class="sticker-section-nav-item" type="button" data-group-jump="${group.domId}" title="${escapeAttribute(group.name)}">
          <span aria-hidden="true">${group.flag}</span>
          <span>${escapeHtml(group.kind === "team" ? group.code : group.name)}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function handleGroupJump(event) {
  const button = event.target.closest("[data-group-jump]");
  if (!button) return false;

  event.preventDefault();
  document.getElementById(button.dataset.groupJump)?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
  return true;
}

function getStickerSectionId(sticker) {
  if (sticker.section_id) return sticker.section_id;
  if (sticker.team_code || sticker.teamCode) return `team-${String(sticker.team_code || sticker.teamCode).toLowerCase()}`;
  return String(sticker.group_code || sticker.groupCode || "catalogo").toLowerCase();
}

function createVirtualSection(sticker, sectionId) {
  return {
    id: sectionId,
    name: sticker.section_name || sticker.teamName || sticker.team_code || sticker.code || "Secao",
    code: sticker.team_code || sticker.teamCode || sticker.group_code || sticker.groupCode || "",
    team_code: sticker.team_code || sticker.teamCode || "",
    kind: sticker.team_code || sticker.teamCode ? "team" : "special",
    display_order: getOfficialStickerSectionOrder(sticker)
  };
}

function getOfficialSectionOrder(section, sticker = {}) {
  const code = String(section.team_code || section.code || sticker.team_code || sticker.teamCode || section.group_code || sticker.group_code || sticker.groupCode || "").toUpperCase();
  return SECTION_ORDER_MAP.get(code) || Number(section.display_order ?? sticker.display_order ?? sticker.displayOrder ?? sticker.number ?? 999);
}

function getOfficialStickerSectionOrder(sticker = {}) {
  const code = String(sticker.team_code || sticker.teamCode || sticker.group_code || sticker.groupCode || "").toUpperCase();
  return SECTION_ORDER_MAP.get(code) || Number(sticker.display_order ?? sticker.displayOrder ?? sticker.number ?? 999);
}

function compareStickers(a, b) {
  return Number(a.display_order ?? a.displayOrder ?? a.number ?? 0) - Number(b.display_order ?? b.displayOrder ?? b.number ?? 0)
    || Number(a.number ?? 0) - Number(b.number ?? 0)
    || String(a.code).localeCompare(String(b.code));
}

function groupDomId(value) {
  return `sticker-section-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function getSectionFlag(group) {
  if (group.kind !== "team") {
    return group.code === "CC" ? "CC" : "★";
  }

  return teamFlags[group.code] || group.code;
}

const teamFlags = {
  MEX: "🇲🇽",
  RSA: "🇿🇦",
  KOR: "🇰🇷",
  CZE: "🇨🇿",
  CAN: "🇨🇦",
  BIH: "🇧🇦",
  QAT: "🇶🇦",
  SUI: "🇨🇭",
  BRA: "🇧🇷",
  MAR: "🇲🇦",
  HAI: "🇭🇹",
  SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  USA: "🇺🇸",
  PAR: "🇵🇾",
  AUS: "🇦🇺",
  TUR: "🇹🇷",
  GER: "🇩🇪",
  CUW: "🇨🇼",
  CIV: "🇨🇮",
  ECU: "🇪🇨",
  NED: "🇳🇱",
  JPN: "🇯🇵",
  SWE: "🇸🇪",
  TUN: "🇹🇳",
  BEL: "🇧🇪",
  EGY: "🇪🇬",
  IRN: "🇮🇷",
  NZL: "🇳🇿",
  ESP: "🇪🇸",
  CPV: "🇨🇻",
  KSA: "🇸🇦",
  URU: "🇺🇾",
  FRA: "🇫🇷",
  SEN: "🇸🇳",
  IRQ: "🇮🇶",
  NOR: "🇳🇴",
  ARG: "🇦🇷",
  ALG: "🇩🇿",
  AUT: "🇦🇹",
  JOR: "🇯🇴",
  POR: "🇵🇹",
  COD: "🇨🇩",
  UZB: "🇺🇿",
  COL: "🇨🇴",
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  CRO: "🇭🇷",
  GHA: "🇬🇭",
  PAN: "🇵🇦"
};

function renderPlaceholder(page) {
  const data = placeholderPages[page];
  document.querySelector("[data-placeholder-page]").innerHTML = `
    <div class="page-header">
      <div>
        <p class="eyebrow">Sprint 03</p>
        <h1>${data.title}</h1>
      </div>
    </div>
    <div class="surface empty-state">
      <div>
        <h2>${data.title}</h2>
        <p>${data.description}</p>
        <p>${data.note}</p>
        <a class="button button-primary" href="feira.html">Abrir Feira</a>
      </div>
    </div>
  `;
}

function emptyMessage(title, description) {
  return `
    <div class="surface empty-state">
      <div>
        <h2>${title}</h2>
        <p>${description}</p>
      </div>
    </div>
  `;
}

function paintAuthNotice(message) {
  if (!message || isAuthConfigured()) return;
  setFormMessage(message, "Supabase nao configurado. Informe URL e anon key do projeto DOZEDEV Studio em assets/js/config/supabase.js.", "error");
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Informe um email valido.");
  }
}

function setLoading(button, isLoading, label) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = label;
}

function setFormMessage(element, message, tone = "neutral") {
  if (!element) return;
  element.textContent = message || "";
  element.dataset.tone = tone;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function getInitials(value = "") {
  return String(value)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "DS";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
