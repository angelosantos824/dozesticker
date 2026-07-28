export function createModal({ title, body, actionLabel = "Confirmar" }) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">${title}</h2>
      <p>${body}</p>
      <div class="actions-row">
        <button class="button button-secondary" type="button" data-modal-close>Fechar</button>
        <button class="button button-primary" type="button" data-modal-action>${actionLabel}</button>
      </div>
    </section>
  `;

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop || event.target.closest("[data-modal-close]")) {
      backdrop.hidden = true;
    }
  });

  document.body.append(backdrop);
  return {
    open: () => {
      backdrop.hidden = false;
      backdrop.querySelector("[data-modal-close]").focus();
    },
    close: () => {
      backdrop.hidden = true;
    },
    element: backdrop
  };
}
