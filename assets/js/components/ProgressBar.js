export function ProgressBar(value, label = "Progresso") {
  return `
    <div class="progress-block">
      <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" aria-label="${label}: ${value}%">
        <div class="progress-fill" style="--progress-value: ${value}%"></div>
      </div>
    </div>
  `;
}
