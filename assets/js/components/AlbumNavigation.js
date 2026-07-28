export function AlbumNavigation(sections, activeSectionId) {
  return `
    <nav class="album-nav" aria-label="Navegacao do album">
      <button class="album-nav-item" type="button" data-section-id="" aria-pressed="${!activeSectionId}">Colecao</button>
      ${sections.map((section) => `
        <button class="album-nav-item is-${section.kind || "special"}" type="button" data-section-id="${section.id}" aria-pressed="${section.id === activeSectionId}">
          ${section.name}
        </button>
      `).join("")}
    </nav>
  `;
}
