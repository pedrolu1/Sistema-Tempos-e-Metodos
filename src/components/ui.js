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

export function modal({ title, body, footer, onClose, largo = false }) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const stop = (e) => e.stopPropagation();
  const box = el(
    'div',
    { class: `modal${largo ? ' modal-lg' : ''}`, onclick: stop },
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
  // Esc fecha; o ouvinte se remove sozinho quando o modal sai da tela por
  // qualquer caminho (antes ficava acumulado a cada modal aberto)
  document.addEventListener('keydown', function esc(e) {
    if (!backdrop.isConnected) {
      if (backdrop.dataset.aberto) document.removeEventListener('keydown', esc);
      return;
    }
    backdrop.dataset.aberto = '1';
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', esc);
      onClose();
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

/** Aviso amigável no lugar de uma tela que falhou (o erro já foi registrado). */
/** Crédito de quem criou o app — discreto, no login, no menu lateral e no menu do celular. */
export const CREDITO = 'Criado por Pedro · Planejamento Coqueria · Ternium RJ';
export const credito = (classe = '') => el('div', { class: `credito ${classe}`.trim() }, CREDITO);

export function avisoFalha({ aoTentar, aoReparar }) {
  return el('div', { class: 'card card-pad', style: { display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' } }, [
    el('strong', { style: { fontFamily: 'var(--font-display)', fontSize: '15px' } }, 'Esta tela teve um problema'),
    el('p', { style: { fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.5' } }, 'O problema foi registrado automaticamente. Seus dados estão guardados. Toque em "Tentar de novo"; se continuar, use "Reparar o app".'),
    el('div', { class: 'toolbar' }, [
      button({ label: 'Tentar de novo', variant: 'primary', onClick: aoTentar }),
      aoReparar ? button({ label: 'Reparar o app', variant: 'ghost', onClick: aoReparar }) : null
    ])
  ]);
}

/** Confirmação rápida e visível (ex.: lançamento registrado) — some sozinha. */
export function celebrar(titulo, subtitulo = '') {
  navigator.vibrate?.([20, 40, 30]);
  const node = el('div', { class: 'celebrate', role: 'status' }, [
    el('div', { class: 'celebrate-card' }, [
      el('span', { class: 'celebrate-check', html: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' }),
      el('strong', {}, titulo),
      subtitulo ? el('small', {}, subtitulo) : null
    ])
  ]);
  node.addEventListener('click', () => node.remove());
  document.body.appendChild(node);
  setTimeout(() => node.classList.add('out'), 1300);
  setTimeout(() => node.remove(), 1650);
}
