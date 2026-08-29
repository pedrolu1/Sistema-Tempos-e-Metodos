import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

let stack;

function ensureStack() {
  if (!stack) {
    stack = el('div', { class: 'toast-stack' });
    document.body.appendChild(stack);
  }
  return stack;
}

const ICONS = { ok: icon.check(16), error: icon.x(16), info: icon.alert(16) };

export function toast(message, type = 'info', duration = 3600) {
  const root = ensureStack();
  const node = el('div', { class: `toast toast-${type}` }, [
    ICONS[type] ? el('span', { html: ICONS[type] }) : null,
    el('span', {}, message)
  ]);
  root.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity 200ms ease, transform 200ms ease';
    node.style.opacity = '0';
    node.style.transform = 'translateY(6px)';
    setTimeout(() => node.remove(), 220);
  }, duration);
}
