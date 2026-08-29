import { el } from '../utils/dom.js';

export function field({ label, hint, error, input }) {
  return el('div', { class: 'field' }, [
    label ? el('label', { class: 'field-label' }, label) : null,
    input,
    hint && !error ? el('div', { class: 'field-hint' }, hint) : null,
    error ? el('div', { class: 'field-error' }, error) : null
  ]);
}

export function button({ label, variant = 'ghost', size = '', icon, onClick, type = 'button', disabled = false, block = false, iconOnly = false }) {
  const classes = ['btn', `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', iconOnly && 'btn-icon'].filter(Boolean).join(' ');
  return el('button', { class: classes, type, onclick: onClick, disabled }, [
    icon ? el('span', { html: icon, style: { display: 'inline-flex' } }) : null,
    iconOnly ? null : label
  ]);
}

export function badge(text, tone = 'neutral', withDot = false) {
  return el('span', { class: `badge badge-${tone}` }, [withDot ? el('span', { class: 'badge-dot' }) : null, text]);
}

export function card(children, opts = {}) {
  return el('div', { class: `card ${opts.pad !== false ? 'card-pad' : ''} ${opts.class || ''}` }, children);
}

export function cardWithHeader({ title, subtitle, actions, children }) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card-header' }, [
      el('div', {}, [
        el('div', { class: 'card-title' }, title),
        subtitle ? el('div', { class: 'card-subtitle' }, subtitle) : null
      ]),
      actions ? el('div', { class: 'toolbar' }, actions) : null
    ]),
    el('div', { class: 'card-pad' }, children)
  ]);
}

export function emptyState({ icon, title, message }) {
  return el('div', { class: 'empty-state' }, [
    icon ? el('div', { html: icon }) : null,
    el('strong', {}, title),
    message ? el('p', {}, message) : null
  ]);
}

export function spinner() {
  return el('div', { class: 'spinner' });
}

export function modal({ title, body, footer, onClose }) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const stop = (e) => e.stopPropagation();
  const box = el(
    'div',
    { class: 'modal', onclick: stop },
    [
      el('div', { class: 'modal-header' }, [
        el('h3', {}, title),
        button({ iconOnly: true, variant: 'ghost', icon: closeIcon(), onClick: onClose })
      ]),
      el('div', { class: 'modal-body' }, body),
      footer ? el('div', { class: 'modal-footer' }, footer) : null
    ]
  );
  backdrop.appendChild(box);
  backdrop.addEventListener('click', onClose);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') {
      onClose();
      document.removeEventListener('keydown', esc);
    }
  });
  return backdrop;
}

function closeIcon() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
}

export function segmented(options, value, onChange) {
  const wrap = el('div', { class: 'segmented' });
  options.forEach((opt) => {
    const b = el('button', { type: 'button', class: opt.value === value ? 'active' : '' }, opt.label);
    b.addEventListener('click', () => onChange(opt.value));
    wrap.appendChild(b);
  });
  return wrap;
}

export function switchToggle(checked, onChange) {
  const input = el('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked) });
  return el('label', { class: 'switch' }, [input, el('span', { class: 'switch-track' })]);
}
