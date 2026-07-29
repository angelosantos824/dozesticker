import { buildMapLinks, sanitizeUrl } from "../services/ads.service.js";

export function AdCard(ad) {
  const links = buildMapLinks(ad);
  const destinationUrl = sanitizeUrl(ad.destination_url);
  const image = ad.image_url
    ? `<img src="${escapeAttribute(ad.image_url)}" alt="" loading="lazy">`
    : `<div class="ad-card-placeholder" aria-hidden="true">12</div>`;

  return `
    <article class="ad-card">
      <div class="ad-card-media">${image}</div>
      <div class="ad-card-body">
        <p class="eyebrow">Anuncio</p>
        <h3>${escapeHtml(ad.title)}</h3>
        ${ad.venue_name ? `<p><strong>${escapeHtml(ad.venue_name)}</strong></p>` : ""}
        ${ad.description ? `<p>${escapeHtml(ad.description)}</p>` : ""}
        <div class="ad-actions">
          ${destinationUrl ? `<a class="button button-primary" href="${escapeAttribute(destinationUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ad.cta_label || "Abrir")}</a>` : ""}
          ${ad.whatsapp ? `<a class="button button-secondary" href="https://wa.me/${escapeAttribute(ad.whatsapp.replace(/^\+/, ""))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}
          ${ad.phone ? `<a class="button button-secondary" href="tel:${escapeAttribute(ad.phone)}">Ligar</a>` : ""}
          ${(links.googleMapsUrl || links.appleMapsUrl || ad.address) ? `<button class="button button-secondary" type="button" data-map-ad="${escapeAttribute(ad.id)}">Como chegar</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

export function AdCarousel(ads, options = {}) {
  if (!ads.length) return "";
  const slides = chunkAds(ads, 2);
  const eyebrow = options.eyebrow || "Parceiros";
  const title = options.title || "Anuncios e parceiros";

  return `
    <section class="ads-section" aria-label="${escapeAttribute(title)}">
      <div class="section-heading">
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
      </div>
      <div class="ad-flash" data-ad-flash>
        <div class="ad-flash-viewport">
          ${slides.map((slide, index) => `
            <div class="ad-flash-slide ${index === 0 ? "is-active" : ""}" data-ad-slide="${index}" aria-hidden="${index === 0 ? "false" : "true"}">
              ${slide.map(AdCard).join("")}
            </div>
          `).join("")}
        </div>
        ${slides.length > 1 ? `
          <div class="ad-flash-dots" aria-label="Eventos em destaque">
            ${slides.map((_, index) => `<button type="button" data-ad-dot="${index}" aria-label="Mostrar grupo ${index + 1}" aria-pressed="${index === 0}"></button>`).join("")}
          </div>
        ` : ""}
      </div>
    </section>
  `;
}

function chunkAds(ads, size) {
  const chunks = [];
  for (let index = 0; index < ads.length; index += size) {
    chunks.push(ads.slice(index, index + size));
  }
  return chunks;
}

export function openMapMenu(ad) {
  const links = buildMapLinks(ad);
  const actions = [
    links.googleMapsUrl ? `<a class="button button-primary" href="${escapeAttribute(links.googleMapsUrl)}" target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a>` : "",
    links.appleMapsUrl ? `<a class="button button-secondary" href="${escapeAttribute(links.appleMapsUrl)}" target="_blank" rel="noopener noreferrer">Abrir no Apple Maps</a>` : "",
    ad.address ? `<button class="button button-secondary" type="button" data-copy-address="${escapeAttribute(ad.address)}">Copiar endereco</button>` : ""
  ].filter(Boolean).join("");

  return `
    <div class="modal-backdrop" data-map-modal>
      <div class="modal" role="dialog" aria-modal="true" aria-label="Como chegar">
        <div class="section-heading">
          <h2>Como chegar</h2>
          <button class="button button-secondary" type="button" data-close-map>Fechar</button>
        </div>
        <div class="ad-map-actions">${actions}</div>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
