import { el, mount } from '../../utils/dom.js';
import { badge, button, emptyState, field, modal, cardWithHeader } from '../../components/ui.js';
import { liderSelect, colaboradoresPicker } from '../../components/PeoplePicker.js';
import { icon } from '../../utils/icons.js';
import { formatDateBR, formatMinutes } from '../../utils/format.js';
import { updateLancamento, deleteLancamento } from '../../lib/records.js';
import { exportExcel, exportPDF, exportWord } from '../../lib/export.js';
import { toast } from '../../lib/toast.js';

export function renderRecordsPage(ctx) {
  let lancamentos = ctx.lancamentos;
  let colaboradores = ctx.colaboradores;
  let atividades = ctx.atividades;

  const filters = { de: '', ate: '', tipo: 'todos', status: 'todos', busca: '' };

  const deInput = el('input', { class: 'input', type: 'date', onchange: (e) => { filters.de = e.target.value; paint(); } });
  const ateInput = el('input', { class: 'input', type: 'date', onchange: (e) => { filters.ate = e.target.value; paint(); } });
  const tipoSelect = el('select', { class: 'select', onchange: (e) => { filters.tipo = e.target.value; paint(); } }, [
    el('option', { value: 'todos' }, 'Todos os tipos'),
    el('option', { value: 'atividade' }, 'Atividades'),
    el('option', { value: 'improdutividade' }, 'Improdutividades')
  ]);
  const statusSelect = el('select', { class: 'select', onchange: (e) => { filters.status = e.target.value; paint(); } }, [
    el('option', { value: 'todos' }, 'Todos os status'),
    el('option', { value: 'sincronizado' }, 'Sincronizados'),
    el('option', { value: 'pendente' }, 'Pendentes')
  ]);
  const buscaInput = el('input', { class: 'input', type: 'text', placeholder: 'Buscar por atividade, líder ou colaborador…', oninput: (e) => { filters.busca = e.target.value.toLowerCase(); paint(); } });

  const countLabel = el('span', { style: { fontSize: '12.5px', color: 'var(--text-2)' } });
  const tableWrap = el('div');

  const exportBtns = el('div', { class: 'toolbar' }, [
    button({ label: 'Excel', size: 'sm', variant: 'outline', icon: icon.fileSpreadsheet(15), onClick: () => exportExcel(filtered()) }),
    button({ label: 'PDF', size: 'sm', variant: 'outline', icon: icon.fileText(15), onClick: () => exportPDF(filtered(), undefined, { periodo: periodoLabel() }) }),
    button({ label: 'Word', size: 'sm', variant: 'outline', icon: icon.fileWord(15), onClick: () => exportWord(filtered(), undefined, { periodo: periodoLabel() }) })
  ]);

  const node = cardWithHeader({
    title: 'Todos os lançamentos',
    subtitle: 'Filtre e exporte os apontamentos coletados em campo',
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
      if (filters.busca) {
        const haystack = [l.atividadeNome, l.liderNome, ...(l.colaboradoresNomes || [])].join(' ').toLowerCase();
        if (!haystack.includes(filters.busca)) return false;
      }
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
    const wrap = el('div', { class: 'table-wrap' });
    mount(wrap, [
      el('table', { class: 'data-table' }, [
        el(
          'thead',
          {},
          el('tr', {}, [
            el('th', {}, 'Data'), el('th', {}, 'Horário'), el('th', {}, 'Duração'), el('th', {}, 'Tipo'),
            el('th', {}, 'Descrição'), el('th', {}, 'Líder'), el('th', {}, 'Colaboradores'),
            el('th', {}, 'Lançado por'), el('th', {}, 'Status'), el('th', {}, 'Ações')
          ])
        ),
        el(
          'tbody',
          {},
          rows.map((l) =>
            el('tr', {}, [
              el('td', {}, formatDateBR(l.data)),
              el('td', { class: 'mono' }, `${l.horaInicio}–${l.horaTermino}`),
              el('td', { class: 'mono' }, formatMinutes(l.duracaoMinutos)),
              el('td', {}, badge(l.tipoRegistro === 'improdutividade' ? 'Improd.' : 'Atividade', l.tipoRegistro === 'improdutividade' ? 'danger' : 'info')),
              el('td', { class: 'strong' }, l.atividadeNome || '—'),
              el('td', {}, l.liderNome || '—'),
              el('td', {}, colabCell(l.colaboradoresNomes || [])),
              el('td', {}, l.criadoPorNome || '—'),
              el('td', {}, badge(l._sincronizado === false ? 'Pendente' : 'Sincronizado', l._sincronizado === false ? 'warn' : 'ok', true)),
              el('td', {}, el('div', { class: 'toolbar' }, [
                button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.edit(15), onClick: () => openEdit(l) }),
                button({ iconOnly: true, size: 'sm', variant: 'danger', icon: icon.trash(15), onClick: () => confirmDelete(l) })
              ]))
            ])
          )
        )
      ])
    ]);
    mount(tableWrap, [wrap]);
  }

  function colabCell(names) {
    if (names.length === 0) return '—';
    if (names.length <= 2) return names.join(', ');
    return el('span', { title: names.join(', ') }, `${names.slice(0, 2).join(', ')} +${names.length - 2}`);
  }

  function confirmDelete(l) {
    const close = () => backdrop.remove();
    const backdrop = modal({
      title: 'Excluir lançamento?',
      body: [el('p', { style: { fontSize: '13.5px', color: 'var(--text-1)' } }, 'Esta ação é permanente.')],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({
          label: 'Excluir',
          variant: 'danger',
          onClick: async () => {
            try {
              await deleteLancamento(l.id);
              toast('Lançamento excluído.', 'ok');
            } catch {
              toast('Não foi possível excluir.', 'error');
            }
            close();
          }
        })
      ],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  function openEdit(l) {
    let liderId = l.liderId;
    let colaboradoresIds = [...(l.colaboradoresIds || [])];
    let tipoRegistro = l.tipoRegistro;

    const dataInput = el('input', { class: 'input', type: 'date', value: l.data });
    const inicioInput = el('input', { class: 'input', type: 'time', value: l.horaInicio });
    const terminoInput = el('input', { class: 'input', type: 'time', value: l.horaTermino });
    const obsInput = el('textarea', { class: 'textarea', value: l.observacoes || '' });
    const tipoSel = el('select', { class: 'select' }, [
      el('option', { value: 'atividade', selected: tipoRegistro === 'atividade' }, 'Atividade'),
      el('option', { value: 'improdutividade', selected: tipoRegistro === 'improdutividade' }, 'Improdutividade')
    ]);

    const atividadeWrap = el('div');
    const liderWrap = el('div');
    const colabWrap = el('div');

    function buildAtividade() {
      const opts = atividades.filter((a) => a.tipo === (tipoRegistro === 'atividade' ? 'produtiva' : 'improdutiva'));
      mount(atividadeWrap, [el('select', { class: 'select' }, [
        el('option', { value: '' }, 'Selecione…'),
        ...opts.map((a) => el('option', { value: a.id, selected: a.id === l.atividadeId }, a.nome))
      ])]);
    }
    function buildLider() {
      mount(liderWrap, [liderSelect({ options: colaboradores, value: liderId, onChange: (v) => { liderId = v; buildColab(); } })]);
    }
    function buildColab() {
      mount(colabWrap, [colaboradoresPicker({ options: colaboradores, selected: colaboradoresIds, excludeId: liderId || undefined, onChange: (ids) => (colaboradoresIds = ids) })]);
    }
    tipoSel.addEventListener('change', (e) => { tipoRegistro = e.target.value; buildAtividade(); });
    buildAtividade();
    buildLider();
    buildColab();

    const close = () => backdrop.remove();
    const backdrop = modal({
      title: 'Editar lançamento',
      body: [
        el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }, [
          field({ label: 'Início', input: inicioInput }),
          field({ label: 'Término', input: terminoInput })
        ]),
        field({ label: 'Data', input: dataInput }),
        field({ label: 'Tipo', input: tipoSel }),
        field({ label: 'Descrição', input: atividadeWrap }),
        field({ label: 'Líder da atividade', input: liderWrap }),
        field({ label: 'Colaboradores', input: colabWrap }),
        field({ label: 'Observações', input: obsInput })
      ],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({
          label: 'Salvar alterações',
          variant: 'primary',
          onClick: async () => {
            const atividadeId = atividadeWrap.querySelector('select').value;
            const atividade = atividades.find((a) => a.id === atividadeId);
            const lider = colaboradores.find((c) => c.id === liderId);
            if (!atividadeId || !liderId || colaboradoresIds.length === 0) {
              toast('Preencha todos os campos obrigatórios.', 'error');
              return;
            }
            try {
              await updateLancamento(l.id, {
                data: dataInput.value,
                horaInicio: inicioInput.value,
                horaTermino: terminoInput.value,
                tipoRegistro,
                contrato: l.contrato || '',
                atividadeId,
                atividadeNome: atividade?.nome || '',
                atividadeTipo: atividade?.tipo || '',
                liderId,
                liderNome: lider?.nomeCompleto || '',
                colaboradoresIds,
                colaboradoresNomes: colaboradoresIds.map((id) => colaboradores.find((c) => c.id === id)?.nomeCompleto || ''),
                observacoes: obsInput.value
              });
              toast('Lançamento atualizado.', 'ok');
              close();
            } catch {
              toast('Não foi possível salvar.', 'error');
            }
          }
        })
      ],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  paint();

  return {
    node,
    update(newCtx) {
      lancamentos = newCtx.lancamentos;
      colaboradores = newCtx.colaboradores;
      atividades = newCtx.atividades;
      paint();
    }
  };
}
