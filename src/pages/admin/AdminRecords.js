import { el, mount } from '../../utils/dom.js';
import { badge, button, emptyState, cardWithHeader } from '../../components/ui.js';
import { abrirEdicaoLancamento, confirmarExclusaoLancamento } from '../../components/EditarLancamento.js';
import { icon } from '../../utils/icons.js';
import { formatDateBR, formatMinutes, efetivoTotal, formatEfetivo, classificacaoDoLancamento, CLASSIFICACAO_INFO } from '../../utils/format.js';
import { exportExcel, exportPDF, exportWord } from '../../lib/export.js';

const PAGINA = 200; // linhas desenhadas por vez (milhares de linhas deixariam a tela lenta)

function leanBadge(l) {
  const info = CLASSIFICACAO_INFO[classificacaoDoLancamento(l)];
  return el('span', { title: info.label, style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '700', color: info.color } }, [
    el('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: info.color, display: 'inline-block' } }),
    info.short
  ]);
}

export function renderRecordsPage(ctx) {
  let { lancamentos, atividades, projetos } = ctx;
  const filters = { de: '', ate: '', tipo: 'todos', status: 'todos', busca: '' };
  let limite = PAGINA;
  const mudou = (fn) => (e) => { fn(e); limite = PAGINA; paint(); };

  const deInput = el('input', { class: 'input', type: 'date', onchange: mudou((e) => { filters.de = e.target.value; }) });
  const ateInput = el('input', { class: 'input', type: 'date', onchange: mudou((e) => { filters.ate = e.target.value; }) });
  const tipoSelect = el('select', { class: 'select', onchange: mudou((e) => { filters.tipo = e.target.value; }) }, [
    el('option', { value: 'todos' }, 'Todos os tipos'),
    el('option', { value: 'atividade' }, 'Atividades'),
    el('option', { value: 'improdutividade' }, 'Improdutividades')
  ]);
  const statusSelect = el('select', { class: 'select', onchange: mudou((e) => { filters.status = e.target.value; }) }, [
    el('option', { value: 'todos' }, 'Todos os status'),
    el('option', { value: 'sincronizado' }, 'Sincronizados'),
    el('option', { value: 'pendente' }, 'Pendentes')
  ]);
  const buscaInput = el('input', { class: 'input', type: 'text', placeholder: 'Buscar por atividade, projeto ou quem lançou…', oninput: mudou((e) => { filters.busca = e.target.value.toLowerCase(); }) });

  const countLabel = el('span', { style: { fontSize: '12.5px', color: 'var(--text-2)' } });
  const tableWrap = el('div');

  const exportBtns = el('div', { class: 'toolbar' }, [
    button({ label: 'Excel', size: 'sm', variant: 'outline', icon: icon.fileSpreadsheet(15), onClick: () => exportExcel(filtered()) }),
    button({ label: 'PDF', size: 'sm', variant: 'outline', icon: icon.fileText(15), onClick: () => exportPDF(filtered(), undefined, { periodo: periodoLabel() }) }),
    button({ label: 'Word', size: 'sm', variant: 'outline', icon: icon.fileWord(15), onClick: () => exportWord(filtered(), undefined, { periodo: periodoLabel() }) })
  ]);

  const node = cardWithHeader({
    title: 'Todos os lançamentos',
    subtitle: 'Filtre, corrija e exporte os apontamentos coletados em campo',
    actions: [exportBtns],
    children: [
      el('div', { class: 'toolbar', style: { marginBottom: '16px' } }, [deInput, ateInput, tipoSelect, statusSelect, buscaInput]),
      countLabel,
      el('div', { style: { height: '10px' } }),
      tableWrap
    ]
  });

  function periodoLabel() {
    if (filters.de && filters.ate) return `${formatDateBR(filters.de)} a ${formatDateBR(filters.ate)}`;
    if (filters.de) return `a partir de ${formatDateBR(filters.de)}`;
    if (filters.ate) return `até ${formatDateBR(filters.ate)}`;
    return 'todo o período';
  }

  function filtered() {
    return lancamentos.filter((l) => {
      if (filters.de && l.data < filters.de) return false;
      if (filters.ate && l.data > filters.ate) return false;
      if (filters.tipo !== 'todos' && l.tipoRegistro !== filters.tipo) return false;
      if (filters.status === 'sincronizado' && l._sincronizado === false) return false;
      if (filters.status === 'pendente' && l._sincronizado !== false) return false;
      if (filters.busca && ![l.atividadeNome, l.projetoNome, l.criadoPorNome].join(' ').toLowerCase().includes(filters.busca)) return false;
      return true;
    });
  }

  function paint() {
    const rows = filtered();
    countLabel.textContent = `${rows.length} lançamento(s)`;
    if (rows.length === 0) {
      mount(tableWrap, [emptyState({ icon: icon.clock(38), title: 'Nada encontrado', message: 'Ajuste os filtros para ver outros lançamentos.' })]);
      return;
    }
    const visiveis = rows.slice(0, limite);
    mount(tableWrap, [
      el('div', { class: 'table-wrap' }, [
        el('table', { class: 'data-table' }, [
          el('thead', {}, el('tr', {}, ['Data', 'Horário', 'Duração', 'Tipo', 'Lean', 'Atividade', 'Equipe', 'Lançado por', 'Status', 'Ações'].map((h) => el('th', {}, h)))),
          el('tbody', {}, visiveis.map((l) =>
            el('tr', {}, [
              el('td', {}, formatDateBR(l.data)),
              el('td', { class: 'mono' }, `${l.horaInicio}–${l.horaTermino}`),
              el('td', { class: 'mono' }, formatMinutes(l.duracaoMinutos)),
              el('td', {}, badge(l.tipoRegistro === 'improdutividade' ? 'Improd.' : 'Atividade', l.tipoRegistro === 'improdutividade' ? 'danger' : 'ok')),
              el('td', {}, leanBadge(l)),
              el('td', { class: 'strong' }, [
                l.atividadeNome || '—',
                l.projetoNome ? el('div', { style: { fontSize: '11.5px', fontWeight: '500', color: 'var(--text-2)' } }, l.projetoNome) : null
              ]),
              el('td', { class: 'mono', title: formatEfetivo(l.efetivo) }, String(efetivoTotal(l.efetivo))),
              el('td', {}, l.criadoPorNome || '—'),
              el('td', {}, badge(l._sincronizado === false ? 'Pendente' : 'Sincronizado', l._sincronizado === false ? 'warn' : 'ok', true)),
              el('td', {}, el('div', { class: 'toolbar' }, [
                button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.edit(15), onClick: () => abrirEdicaoLancamento(l, { projetos, atividades }) }),
                button({ iconOnly: true, size: 'sm', variant: 'danger', icon: icon.trash(15), onClick: () => confirmarExclusaoLancamento(l) })
              ]))
            ])
          ))
        ])
      ]),
      rows.length > limite
        ? el('div', { style: { display: 'flex', justifyContent: 'center', marginTop: '14px' } }, [
            button({ label: `Mostrar mais (${rows.length - limite} restantes)`, variant: 'outline', size: 'sm', onClick: () => { limite += PAGINA; paint(); } })
          ])
        : null
    ]);
  }

  paint();

  return {
    node,
    update(newCtx) {
      ({ lancamentos, atividades, projetos } = newCtx);
      paint();
    }
  };
}
