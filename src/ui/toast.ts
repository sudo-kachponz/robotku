// src/ui/toast.ts
// Minimal DS-styled toast notifications.

export type ToastKind = 'info' | 'success' | 'error' | 'warn';

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (container) return container;
  container = document.createElement('div');
  container.className = 'rk-toast-container';
  document.body.appendChild(container);
  return container;
}

export function showToast(message: string, kind: ToastKind = 'info', ms = 3200): void {
  const root = ensureContainer();
  const toast = document.createElement('div');
  toast.className = `rk-toast rk-toast--${kind}`;
  toast.textContent = message;
  root.appendChild(toast);

  // enter animation
  requestAnimationFrame(() => toast.classList.add('rk-toast--in'));

  const remove = () => {
    toast.classList.remove('rk-toast--in');
    setTimeout(() => toast.remove(), 220);
  };
  setTimeout(remove, ms);
  toast.addEventListener('click', remove);
}
