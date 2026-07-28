import { ProgressBar } from "./ProgressBar.js";

export function SectionHeader(title, progress) {
  return `
    <header class="album-section-header">
      <div>
        <p class="eyebrow">${title === "Colecao" ? "Album completo" : "Secao"}</p>
        <h2>${title}</h2>
      </div>
      <div class="section-progress">
        <strong>${progress.have} / ${progress.total}</strong>
        <span>${progress.progress}%</span>
      </div>
      ${ProgressBar(progress.progress, `Progresso de ${title}`)}
    </header>
  `;
}
