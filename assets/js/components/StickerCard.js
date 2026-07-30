export function StickerCard(sticker) {
  const rare = sticker.is_rare || sticker.isRare;
  const ownershipAttributes = sticker.catalogSource === "remote"
    ? `data-sticker-id="${sticker.id}" data-has-sticker="${sticker.hasSticker}"`
    : `disabled aria-disabled="true" title="Catalogo temporario: posse indisponivel"`;

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
      <button class="album-sticker-state" type="button" ${ownershipAttributes}>
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
