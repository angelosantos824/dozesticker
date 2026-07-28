export function SearchBar({ placeholder = "Pesquisar por codigo, numero, jogador, selecao ou grupo", id = "album-search" } = {}) {
  return `
    <label class="field album-search">
      <span>Pesquisa global</span>
      <input id="${id}" type="search" inputmode="search" autocomplete="off" placeholder="${placeholder}" data-album-search>
    </label>
  `;
}
