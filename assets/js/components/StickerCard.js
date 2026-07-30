export function StickerCard(sticker) {
  const rare = sticker.is_rare || sticker.isRare;
  const stickerId = getStickerUuid(sticker);
  const buttonAttributes = stickerId
    ? `data-sticker-id="${stickerId}" data-has-sticker="${sticker.hasSticker}"`
    : `disabled aria-disabled="true" title="Catalogo remoto indisponivel"`;

  auditStickerRender("renderSticker/createStickerCard", {
    sticker,
    datasetStickerId: stickerId
  });

  return `
    <article class="album-sticker ${sticker.hasSticker ? "is-owned" : "is-missing"}">
      <div class="album-sticker-frame" aria-hidden="true">
        ${rare ? `<span class="rare-star" title="Rara">&#9733;</span>` : ""}
      </div>
      <div class="album-sticker-body">
        <strong class="album-sticker-code">${sticker.code}</strong>
        <h3>${sticker.title}</h3>
        <p>${sticker.section_name}${sticker.type ? ` &middot; ${typeLabel(sticker.type)}` : ""}</p>
      </div>
      <button class="album-sticker-state" type="button" ${buttonAttributes}>
        ${sticker.hasSticker ? "&#10003; Tenho" : "&#9675; Falta"}
      </button>
    </article>
  `;
}

export function typeLabel(type) {
  const labels = {
    player: "Jogador",
    goalkeeper: "Goleiro",
    team_photo: "Time",
    logo: "Logo",
    badge: "Escudo",
    stadium: "Estadio",
    mascot: "Mascote",
    trophy: "Trofeu",
    poster: "Poster",
    special: "Especial",
    promo: "Promo"
  };
  return labels[type] || type;
}

function getStickerUuid(sticker) {
  return isUuid(sticker?.id) ? sticker.id : "";
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

function auditStickerRender(etapa, { sticker, datasetStickerId }) {
  if (!isLegacyStickerId(sticker?.id) && !isLegacyStickerId(datasetStickerId)) return;

  console.warn("[ALBUM AUDIT]", {
    etapa,
    idRecebido: sticker?.id || "",
    codigoExibicao: sticker?.code || "",
    idArmazenadoNoDataset: datasetStickerId || "",
    idEnviadoParaToggle: "",
    idEnviadoParaSync: "",
    motivo: "ID legado bloqueado antes de criar dataset.stickerId"
  });
}

function isLegacyStickerId(value = "") {
  return Boolean(value && !isUuid(value));
}
