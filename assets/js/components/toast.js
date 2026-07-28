let toastTimer;

export function showToast(message, options = {}) {
  const region = document.querySelector("[data-toast-region]");
  if (!region || !message) return;

  window.clearTimeout(toastTimer);
  region.innerHTML = "";

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <span>${message}</span>
    ${options.actionLabel ? `<button class="toast-action" type="button">${options.actionLabel}</button>` : ""}
  `;
  region.append(toast);

  const action = toast.querySelector(".toast-action");
  if (action) {
    action.addEventListener("click", () => {
      window.clearTimeout(toastTimer);
      toast.remove();
      options.onAction?.();
    });
  }

  toastTimer = window.setTimeout(() => {
    toast.remove();
  }, options.duration || 3600);
}

export function bindToastButtons() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-toast]");
    if (!button) return;
    showToast(button.dataset.toast);
  });
}
