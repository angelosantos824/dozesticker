const cacheName = "dozesticker-v0.7.0-admin-dashboard-trade-event";
const appShell = [
  "./",
  "./index.html",
  "./login.html",
  "./cadastro.html",
  "./recuperar-senha.html",
  "./nova-senha.html",
  "./perfil.html",
  "./feira.html",
  "./album.html",
  "./dashboard.html",
  "./colecao.html",
  "./troca.html",
  "./faltantes.html",
  "./repetidas.html",
  "./pacotes.html",
  "./trocas.html",
  "./configuracoes.html",
  "./admin-anuncios.html",
  "./manifest.webmanifest",
  "./assets/css/variables.css",
  "./assets/css/reset.css",
  "./assets/css/layout.css",
  "./assets/css/components.css",
  "./assets/css/responsive.css",
  "./assets/css/responsive.css?v=0.6.9",
  "./assets/css/pages/auth.css",
  "./assets/css/pages/feira.css",
  "./assets/css/pages/album.css",
  "./assets/css/pages/album.css?v=0.6.9",
  "./assets/css/pages/dashboard.css",
  "./assets/css/pages/colecao.css",
  "./assets/js/app.js",
  "./assets/js/auth/auth-guard.js",
  "./assets/js/config/supabase.js",
  "./assets/js/data/world-cup-2026.catalog.js",
  "./assets/js/utils/storage.js",
  "./assets/js/components/navigation.js",
  "./assets/js/components/toast.js",
  "./assets/js/components/AlbumNavigation.js",
  "./assets/js/components/ProgressBar.js",
  "./assets/js/components/SearchBar.js",
  "./assets/js/components/SectionHeader.js",
  "./assets/js/components/StickerCard.js",
  "./assets/js/components/AdCard.js",
  "./assets/js/services/auth.service.js",
  "./assets/js/services/collection.service.js",
  "./assets/js/services/ads.service.js",
  "./assets/js/services/admin.service.js",
  "./assets/js/services/supabase-client.js",
  "./assets/images/logo/icon.png",
  "./assets/images/brand/dozedev-symbol.png",
  "./assets/images/brand/dozedev-logo-full.png",
  "./assets/images/brand/stadium-full.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(cacheName)
      .then((cache) => cache.addAll(appShell))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./login.html")))
  );
});
