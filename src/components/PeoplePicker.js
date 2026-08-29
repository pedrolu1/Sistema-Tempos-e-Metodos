import { el, mount } from '../utils/dom.js';
import { initials } from '../utils/format.js';
import { icon } from '../utils/icons.js';

export function liderSelect({ options, value, onChange }) {
  const select = el(
    'select',
    { class: 'select', onchange: (e) => onChange(e.target.value) },
    [
      el('option', { value: '' }, 'Selecione o líder…'),
      ...options.map((c) => el('option', { value: c.id, selected: c.id === value }, c.nomeCompleto))
    ]
  );
  return select;
}

/**
 * Multi-seleção de colaboradores com busca por nome completo + chips.
 * `onChange(idsArray)` é chamado a cada alteração.
 */
export function colaboradoresPicker({ options, selected = [], onChange, excludeId }) {
  let query = '';
  let ids = [...selected];

  const root = el('div', { class: 'people-picker' });
  const searchWrap = el('div', { class: 'input-icon-wrap' });
  const searchInput = el('input', {
    class: 'input',
    type: 'text',
    placeholder: 'Buscar colaborador pelo nome…',
    oninput: (e) => {
      query = e.target.value.toLowerCase();
      renderList();
    }
  });
  mount(searchWrap, [el('span', { html: icon.search(16) }), searchInput]);

  const selectedWrap = el('div', {
    class: 'chip-row',
    style: { display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '0' }
  });
  const listWrap = el('div', {
    class: 'people-list',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      maxHeight: '220px',
      overflowY: 'auto',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-md)',
      padding: '6px'
    }
  });

  function toggle(id) {
    ids = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    onChange(ids);
    renderSelected();
    renderList();
  }

  function renderSelected() {
    mount(
      selectedWrap,
      ids.length === 0
        ? [el('span', { style: { color: 'var(--text-3)', fontSize: '12.5px' } }, 'Nenhum colaborador selecionado ainda.')]
        : ids.map((id) => {
            const person = options.find((o) => o.id === id);
            if (!person) return null;
            return el('span', { class: 'chip selected' }, [
              person.nomeCompleto,
              el(
                'span',
                { class: 'chip-remove', onclick: () => toggle(id) },
                el('span', { html: icon.x(11) })
              )
            ]);
          })
    );
  }

  function renderList() {
    const filtered = options
      .filter((o) => o.id !== excludeId)
      .filter((o) => o.nomeCompleto.toLowerCase().includes(query));
    mount(
      listWrap,
      filtered.length === 0
        ? [el('div', { style: { padding: '14px', color: 'var(--text-3)', fontSize: '13px', textAlign: 'center' } }, 'Nenhum colaborador encontrado.')]
        : filtered.map((person) => {
            const active = ids.includes(person.id);
            return el(
              'button',
              {
                type: 'button',
                onclick: () => toggle(person.id),
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 10px',
                  borderRadius: 'var(--r-sm)',
                  border: 'none',
                  background: active ? 'var(--bg-3)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--text-0)',
                  fontSize: '13.5px'
                }
              },
              [
                el('span', { class: 'avatar', style: { width: '28px', height: '28px', fontSize: '11px' } }, initials(person.nomeCompleto)),
                el('span', { style: { flex: '1' } }, person.nomeCompleto),
                active ? el('span', { html: icon.check(16), style: { color: 'var(--accent-400)' } }) : null
              ]
            );
          })
    );
  }

  renderSelected();
  renderList();

  mount(root, [selectedWrap, searchWrap, listWrap]);
  return root;
}
