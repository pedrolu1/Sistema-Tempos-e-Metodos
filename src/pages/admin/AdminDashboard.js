import { el, mount } from '../../utils/dom.js';
import { cardWithHeader, button, segmented } from '../../components/ui.js';
import { statTile, meter, rankingBars, stackedTrend, stackedTrendN } from '../../components/charts.js';
import { icon } from '../../utils/icons.js';
import {
  formatMinutes,
  formatDateBR,
  todayISO,
  classificacaoDoLancamento,
  excedenteMinutos,
  temDesperdicio,
  capacidadeMinutosSetor,
  CLASSIFICACAO_INFO
} from '../../utils/format.js';
import { exportExcel, exportPDF, exportWord } from '../../lib/export.js';
import { calcularIndicadores, planejadoRealPorProjeto } from '../../utils/indicadores.js';
import { navigate } from '../../router.js';
import { toast } from '../../lib/toast.js';
import { achadosAtivos, cartaoAchado } from './AdminAssistente.js';

const CLASSIFICACAO_SERIES = ['VA', 'DN', 'DNN'].map((k) => ({ key: k, label: CLASSIFICACAO_INFO[k].label, color: CLASSIFICACAO_INFO[k].color }));

const PRESETS = {
  hoje: 0,
  '7d': 6,
  '30d': 29,
  '90d': 89,
  tudo: null
};

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

export function renderDashboardPage(ctx) {
  let lancamentos = ctx.lancamentos;
  let setores = ctx.setores || [];
  let fullCtx = ctx; // projetos, atividades, estudos… para o assistente e o relatório
  const state = {
    preset: '30d',
    setor: 'todos',
    contrato: 'todos',
    projetoId: 'todos',
    filters: { tipo: null, atividadeId: null, liderId: null, classificacao: null }
  };

  const filterRow = el('div', { class: 'toolbar' });
  const setorRow = el('div', { class: 'toolbar' });
  const chipsRow = el('div', { class: 'toolbar', style: { minHeight: '20px' } });
  const kpiRow = el('div', { class: 'grid grid-kpis' });
  const meterCard = el('div');
  const trendCard = el('div');
  const leanCard = el('div');
  const desperdicioCard = el('div');
  const insightsCard = el('div');
  const aderenciaCard = el('div');
  const atividadesCard = el('div');
  const improdCard = el('div');
  const lideresCard = el('div');

  const exportBtns = el('div', { class: 'toolbar' }, [
    button({ label: 'Excel', size: 'sm', variant: 'outline', icon: icon.fileSpreadsheet(15), onClick: () => exportExcel(dataset()) }),
    button({ label: 'PDF', size: 'sm', variant: 'outline', icon: icon.fileText(15), onClick: () => exportPDF(dataset(), undefined, { periodo: periodoLabel() }) }),
    button({ label: 'Word', size: 'sm', variant: 'outline', icon: icon.fileWord(15), onClick: () => exportWord(dataset(), undefined, { periodo: periodoLabel() }) }),
    button({ label: 'PowerPoint', size: 'sm', variant: 'primary', icon: icon.fileText(15), onClick: gerarPptx })
  ]);

  async function gerarPptx() {
    const rows = dataset();
    if (!rows.length) return toast('Sem lançamentos no período/filtros para o relatório.', 'error');
    toast('Montando a apresentação…', 'info');
    try {
      const { gerarRelatorioPptx } = await import('../../lib/relatorioPptx.js');
      await gerarRelatorioPptx({
        lancamentos: rows,
        periodo: periodoLabel(),
        filtros: filtrosLabel(),
        projetos: fullCtx.projetos || [],
        achados: achadosAtivos(fullCtx)
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      toast('Não foi possível gerar o PowerPoint.', 'error');
    }
  }

  function filtrosLabel() {
    const partes = [];
    if (state.setor !== 'todos') partes.push(`Setor ${state.setor}`);
    if (state.contrato !== 'todos') partes.push(`Contrato ${state.contrato}`);
    if (state.projetoId !== 'todos') partes.push(`Projeto ${(fullCtx.projetos || []).find((p) => p.id === state.projetoId)?.nome || ''}`);
    return partes.join(' · ') || 'Todos os contratos e projetos';
  }

  const presetTabs = segmented(
    [
      { value: 'hoje', label: 'Hoje' },
      { value: '7d', label: '7 dias' },
      { value: '30d', label: '30 dias' },
      { value: '90d', label: '90 dias' },
      { value: 'tudo', label: 'Tudo' }
    ],
    state.preset,
    (v) => {
      state.preset = v;
      const order = ['hoje', '7d', '30d', '90d', 'tudo'];
      Array.from(presetTabs.children).forEach((b, i) => b.classList.toggle('active', order[i] === v));
      paint();
    }
  );

  mount(filterRow, [
    el('span', { class: 'section-title', style: { padding: '0' } }, 'Período'),
    presetTabs
  ]);

  /** Filtros por dimensão (setor, contrato, projeto) — só aparecem quando há o que escolher. */
  function buildSetorFilter() {
    const filtro = (chave, todosLabel, opcoes) =>
      el('select', { class: 'select', style: { height: '34px', fontSize: '12.5px', width: 'auto', minWidth: '170px' }, onchange: (e) => { state[chave] = e.target.value; paint(); } }, [
        el('option', { value: 'todos', selected: state[chave] === 'todos' }, todosLabel),
        ...opcoes.map(([v, l]) => el('option', { value: v, selected: v === state[chave] }, l))
      ]);
    const contratos = [...new Set(lancamentos.map((l) => l.contrato).filter(Boolean))].sort();
    const projetos = (fullCtx.projetos || []).filter((p) => lancamentos.some((l) => l.projetoId === p.id));
    mount(setorRow, [
      setores.length || contratos.length || projetos.length ? el('span', { class: 'section-title', style: { padding: '0' } }, 'Filtros') : null,
      setores.length ? filtro('setor', 'Todos os setores', setores.map((x) => [x.nome, x.nome])) : null,
      contratos.length ? filtro('contrato', 'Todos os contratos', contratos.map((c) => [c, c])) : null,
      projetos.length ? filtro('projetoId', 'Todos os projetos', projetos.map((p) => [p.id, p.nome])) : null
    ]);
  }

  const node = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } }, [
    el('div', { class: 'page-header' }, [
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [filterRow, setorRow, chipsRow]),
      exportBtns
    ]),
    kpiRow,
    el('div', { class: 'grid grid-charts' }, [trendCard, meterCard]),
    leanCard,
    aderenciaCard,
    el('div', { class: 'grid grid-2' }, [desperdicioCard, insightsCard]),
    el('div', { class: 'grid grid-2' }, [atividadesCard, improdCard]),
    lideresCard
  ]);

  function periodoLabel() {
    if (state.preset === 'tudo') return 'todo o período';
    if (state.preset === 'hoje') return `hoje (${formatDateBR(todayISO())})`;
    return `últimos ${PRESETS[state.preset] + 1} dias`;
  }

  /** Data inicial do período atual (para cálculo de capacidade do turno). */
  function periodoFrom() {
    if (state.preset !== 'tudo') return isoDaysAgo(PRESETS[state.preset]);
    const ds = dataset();
    if (!ds.length) return todayISO();
    return ds.reduce((min, l) => (l.data < min ? l.data : min), ds[0].data);
  }

  function inRange(l) {
    if (state.preset === 'tudo') return true;
    const from = isoDaysAgo(PRESETS[state.preset]);
    return l.data >= from && l.data <= todayISO();
  }

  /** Aplica intervalo de datas + todos os filtros cruzados, exceto as dimensões em excludeDims. */
  function dataset(excludeDims = []) {
    return lancamentos.filter((l) => {
      if (!inRange(l)) return false;
      if (state.setor !== 'todos' && (l.setor || '') !== state.setor) return false;
      if (state.contrato !== 'todos' && (l.contrato || '') !== state.contrato) return false;
      if (state.projetoId !== 'todos' && l.projetoId !== state.projetoId) return false;
      if (!excludeDims.includes('tipo') && state.filters.tipo && l.tipoRegistro !== state.filters.tipo) return false;
      if (!excludeDims.includes('atividadeId') && state.filters.atividadeId && l.atividadeId !== state.filters.atividadeId) return false;
      if (!excludeDims.includes('liderId') && state.filters.liderId && l.liderId !== state.filters.liderId) return false;
      if (!excludeDims.includes('classificacao') && state.filters.classificacao && classificacaoDoLancamento(l) !== state.filters.classificacao) return false;
      return true;
    });
  }

  function toggleFilter(dim, value) {
    state.filters[dim] = state.filters[dim] === value ? null : value;
    paint();
  }

  function paintChips() {
    const chips = [];
    if (state.filters.tipo) {
      chips.push(chip(state.filters.tipo === 'atividade' ? 'Somente atividades' : 'Somente improdutividades', () => toggleFilter('tipo', state.filters.tipo)));
    }
    if (state.filters.atividadeId) {
      const item = lancamentos.find((l) => l.atividadeId === state.filters.atividadeId);
      chips.push(chip(`Item: ${item?.atividadeNome || '—'}`, () => toggleFilter('atividadeId', state.filters.atividadeId)));
    }
    if (state.filters.liderId) {
      const item = lancamentos.find((l) => l.liderId === state.filters.liderId);
      chips.push(chip(`Líder: ${item?.liderNome || '—'}`, () => toggleFilter('liderId', state.filters.liderId)));
    }
    if (state.filters.classificacao) {
      chips.push(chip(CLASSIFICACAO_INFO[state.filters.classificacao].label, () => toggleFilter('classificacao', state.filters.classificacao)));
    }
    mount(chipsRow, chips.length ? [el('span', { style: { fontSize: '11.5px', color: 'var(--text-3)' } }, 'Filtros ativos:'), ...chips] : []);
  }

  function chip(label, onRemove) {
    return el('span', { class: 'chip selected', style: { height: '30px', fontSize: '12px' } }, [
      label,
      el('span', { class: 'chip-remove', onclick: onRemove }, el('span', { html: icon.x(10) }))
    ]);
  }

  function paintKpis(ind) {
    const { totalMin, prodMin, improdMin } = ind;

    mount(kpiRow, [
      statTile({ label: 'Tempo total apontado', value: formatMinutes(totalMin), iconHtml: icon.clock(16) }),
      statTile({
        label: 'Tempo produtivo',
        value: formatMinutes(prodMin),
        iconHtml: icon.bolt(16),
        tone: 'ok',
        active: state.filters.tipo === 'atividade',
        onToggle: () => toggleFilter('tipo', 'atividade')
      }),
      statTile({
        label: 'Tempo improdutivo',
        value: formatMinutes(improdMin),
        iconHtml: icon.alert(16),
        tone: 'danger',
        active: state.filters.tipo === 'improdutividade',
        onToggle: () => toggleFilter('tipo', 'improdutividade')
      }),
      statTile({ label: 'Lançamentos no período', value: String(ind.n), iconHtml: icon.list(16) })
    ]);

    mount(meterCard, [
      cardWithHeader({
        title: 'Produtividade do período',
        subtitle: 'Percentual do tempo apontado em atividades produtivas',
        children: [
          meter({
            label: 'Tempo produtivo',
            ratio: totalMin > 0 ? prodMin / totalMin : 0,
            valueLabel: totalMin > 0 ? `${Math.round((prodMin / totalMin) * 100)}%` : '—',
            color: 'var(--ok-500)'
          }),
          el('div', { style: { height: '6px' } }),
          meter({
            label: 'Tempo improdutivo',
            ratio: totalMin > 0 ? improdMin / totalMin : 0,
            valueLabel: totalMin > 0 ? `${Math.round((improdMin / totalMin) * 100)}%` : '—',
            color: 'var(--danger-500)'
          })
        ]
      })
    ]);
  }

  function paintTrend(ind) {
    const data = ind.porDia.map((d) => ({
      key: d.data,
      label: d.data.slice(8, 10) + '/' + d.data.slice(5, 7),
      fullLabel: formatDateBR(d.data),
      a: d.prod,
      b: d.improd
    }));

    mount(trendCard, [
      cardWithHeader({
        title: 'Produtivo x Improdutivo por dia',
        subtitle: periodoLabel(),
        children: data.length ? [stackedTrend({ data })] : [el('div', { style: { padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' } }, 'Sem lançamentos no período selecionado.')]
      })
    ]);
  }

  function paintLean(ind) {
    const byClass = ind.lean;

    const tiles = CLASSIFICACAO_SERIES.map((s) =>
      statTile({
        label: s.label,
        value: formatMinutes(byClass[s.key]),
        iconHtml: s.key === 'VA' ? icon.bolt(16) : s.key === 'DN' ? icon.clock(16) : icon.alert(16),
        tone: s.key === 'VA' ? 'ok' : s.key === 'DN' ? 'warn' : 'danger',
        active: state.filters.classificacao === s.key,
        onToggle: () => toggleFilter('classificacao', s.key)
      })
    );

    const trendData = ind.porDia.map((d) => ({
      key: d.data,
      label: d.data.slice(8, 10) + '/' + d.data.slice(5, 7),
      fullLabel: formatDateBR(d.data),
      VA: d.VA,
      DN: d.DN,
      DNN: d.DNN
    }));

    mount(leanCard, [
      cardWithHeader({
        title: 'Classificação Lean do tempo (VA / DN / DNN)',
        subtitle: 'Valor Agregado x Desperdício Necessário x Desperdício Não Necessário — clique para filtrar',
        children: [
          el('div', { class: 'grid grid-kpis', style: { marginBottom: '18px' } }, tiles),
          trendData.length
            ? stackedTrendN({ data: trendData, series: CLASSIFICACAO_SERIES })
            : el('div', { style: { padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' } }, 'Sem lançamentos no período selecionado.')
        ]
      })
    ]);
  }

  function aggregateBy(rows, key, nameKey) {
    const map = new Map();
    rows.forEach((l) => {
      const id = l[key];
      if (!id) return;
      if (!map.has(id)) map.set(id, { id, label: l[nameKey] || '—', value: 0 });
      map.get(id).value += l.duracaoMinutos;
    });
    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 8);
  }

  function setorSelecionado() {
    return state.setor !== 'todos' ? setores.find((s) => s.nome === state.setor) : null;
  }

  function paintDesperdicio() {
    const full = dataset();
    const excedenteTotal = full.reduce((s, l) => s + excedenteMinutos(l), 0);
    const comDesperdicio = full.filter((l) => temDesperdicio(l));

    // ranking de atividades que mais estouram o tempo padrão
    const map = new Map();
    full.forEach((l) => {
      const ex = excedenteMinutos(l);
      if (ex <= 0) return;
      if (!map.has(l.atividadeId)) map.set(l.atividadeId, { id: l.atividadeId, label: l.atividadeNome || '—', value: 0 });
      map.get(l.atividadeId).value += ex;
    });
    const ranking = [...map.values()].sort((a, b) => b.value - a.value).slice(0, 6);

    const setor = setorSelecionado();
    const capacidade = setor ? capacidadeMinutosSetor(setor, periodoFrom(), todayISO()) : 0;
    const apontado = full.reduce((s, l) => s + l.duracaoMinutos, 0);

    mount(desperdicioCard, [
      cardWithHeader({
        title: 'Gargalos & desperdício',
        subtitle: 'Tempo perdido acima do padrão e concentração dos maiores ofensores',
        children: [
          el('div', { class: 'grid grid-kpis', style: { marginBottom: '16px' } }, [
            statTile({ label: 'Excedente do padrão', value: formatMinutes(excedenteTotal), iconHtml: icon.alert(16), tone: 'danger' }),
            statTile({ label: 'Lançamentos com desperdício', value: String(comDesperdicio.length), iconHtml: icon.target(16), tone: 'warn' })
          ]),
          setor
            ? el('div', { style: { marginBottom: '16px' } }, [
                meter({
                  label: `Ocupação do turno — ${setor.nome}`,
                  ratio: capacidade > 0 ? apontado / capacidade : 0,
                  valueLabel: capacidade > 0 ? `${Math.round((apontado / capacidade) * 100)}%` : '—',
                  color: 'var(--accent-500)'
                }),
                el('div', { style: { fontSize: '11.5px', color: 'var(--text-3)', marginTop: '6px' } }, `${formatMinutes(apontado)} apontados de ${formatMinutes(capacidade)} de capacidade estimada`)
              ])
            : null,
          el('div', { class: 'section-title', style: { padding: '0 0 8px' } }, 'Atividades que mais estouram o padrão'),
          rankingBars({ data: ranking, color: 'var(--danger-500)', emptyLabel: 'Nenhum estouro de tempo padrão no período. 👏' })
        ]
      })
    ]);
  }

  /** Principais pontos do assistente (mesmas regras da página Assistente). */
  function paintInsights() {
    const achados = achadosAtivos(fullCtx).slice(0, 3);
    mount(insightsCard, [
      cardWithHeader({
        title: 'Assistente — principais pontos',
        subtitle: 'Leitura automática dos dados com princípios Lean',
        actions: [button({ label: 'Ver todos', size: 'sm', variant: 'ghost', onClick: () => navigate('assistente') })],
        children: [
          achados.length
            ? el('div', { class: 'finding-list compact' }, achados.map((a) => cartaoAchado(a, fullCtx)))
            : el('div', { style: { padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' } }, 'Nenhum ponto de atenção no momento. 👏')
        ]
      })
    ]);
  }

  /** Aderência ao planejado: tempo dentro do previsto, equipe conforme e planejado × real por projeto. */
  function paintAderencia(ind) {
    const rows = dataset();
    const projetos = planejadoRealPorProjeto(fullCtx.projetos || [], rows).sort((a, b) => (b.desvio ?? 0) - (a.desvio ?? 0)).slice(0, 8);
    const pctTxt = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
    mount(aderenciaCard, [
      cardWithHeader({
        title: 'Aderência ao planejado',
        subtitle: 'Quanto o realizado em campo seguiu o que foi planejado',
        children: [
          el('div', { class: 'grid grid-kpis', style: { marginBottom: projetos.length ? '18px' : '0' } }, [
            statTile({ label: 'Dentro do tempo planejado', value: pctTxt(ind.aderenciaTempo), iconHtml: icon.clock(16), tone: ind.aderenciaTempo == null || ind.aderenciaTempo >= 0.7 ? 'ok' : 'warn' }),
            statTile({ label: 'Equipe conforme o planejado', value: pctTxt(ind.divergenciaEfetivo == null ? null : 1 - ind.divergenciaEfetivo), iconHtml: icon.crew(16), tone: 'info' }),
            statTile({ label: 'Lançamentos com planejado', value: `${ind.comPadrao} de ${rows.filter((l) => l.tipoRegistro !== 'improdutividade').length}`, iconHtml: icon.target(16) })
          ]),
          projetos.length
            ? el('div', { class: 'table-wrap' }, [
                el('table', { class: 'data-table' }, [
                  el('thead', {}, el('tr', {}, ['Projeto', 'Etapas iniciadas', 'Planejado (execuções feitas)', 'Realizado', 'Desvio', 'Divergências'].map((h) => el('th', {}, h)))),
                  el('tbody', {}, projetos.map((x) => el('tr', { style: { cursor: 'pointer' }, onclick: () => navigate('projetos') }, [
                    el('td', { class: 'strong' }, [x.projeto.nome, el('div', { style: { fontSize: '11.5px', color: 'var(--text-2)', fontWeight: '500' } }, x.projeto.contratoNome)]),
                    el('td', { class: 'mono' }, `${x.iniciadas}/${x.etapas}`),
                    el('td', { class: 'mono' }, formatMinutes(x.planejadoMin)),
                    el('td', { class: 'mono' }, formatMinutes(x.realMin)),
                    el('td', { class: 'mono', style: { fontWeight: '700', color: x.desvio > 0.1 ? 'var(--danger-500)' : x.desvio < -0.1 ? 'var(--ok-500)' : 'var(--text-1)' } },
                      x.desvio == null ? '—' : `${x.desvio > 0 ? '+' : ''}${Math.round(x.desvio * 100)}%`),
                    el('td', { class: 'mono' }, String(x.divergencias))
                  ])))
                ])
              ])
            : null
        ]
      })
    ]);
  }

  function paintAtividades() {
    const rows = dataset(['atividadeId']).filter((l) => l.tipoRegistro === 'atividade');
    const data = aggregateBy(rows, 'atividadeId', 'atividadeNome');
    mount(atividadesCard, [
      cardWithHeader({
        title: 'Atividades produtivas',
        subtitle: 'Top itens por tempo total — clique para filtrar',
        children: [rankingBars({ data, color: 'var(--ok-500)', activeId: state.filters.atividadeId, onSelect: (id) => toggleFilter('atividadeId', id) })]
      })
    ]);
  }

  function paintImprod() {
    const rows = dataset(['atividadeId']).filter((l) => l.tipoRegistro === 'improdutividade');
    const data = aggregateBy(rows, 'atividadeId', 'atividadeNome');
    mount(improdCard, [
      cardWithHeader({
        title: 'Principais improdutividades',
        subtitle: 'Top itens por tempo total — clique para filtrar',
        children: [rankingBars({ data, color: 'var(--danger-500)', activeId: state.filters.atividadeId, onSelect: (id) => toggleFilter('atividadeId', id) })]
      })
    ]);
  }

  function paintLideres() {
    const rows = dataset();
    const data = aggregateBy(rows, 'criadoPorUid', 'criadoPorNome');
    mount(lideresCard, [
      cardWithHeader({
        title: 'Tempo apontado por lançador',
        subtitle: 'Total registrado por cada líder que operou o app no período',
        children: [rankingBars({ data, color: 'var(--accent-500)' })]
      })
    ]);
  }

  function paint() {
    buildSetorFilter();
    paintChips();
    const ind = calcularIndicadores(dataset()); // uma conta só, usada por todos os cards
    paintKpis(ind);
    paintTrend(ind);
    paintLean(ind);
    paintAderencia(ind);
    paintDesperdicio();
    paintInsights();
    paintAtividades();
    paintImprod();
    paintLideres();
  }

  paint();

  return {
    node,
    update(newCtx) {
      lancamentos = newCtx.lancamentos;
      setores = newCtx.setores || [];
      fullCtx = newCtx;
      if (state.projetoId !== 'todos' && !(newCtx.projetos || []).some((p) => p.id === state.projetoId)) state.projetoId = 'todos';
      if (state.setor !== 'todos' && !setores.some((s) => s.nome === state.setor)) state.setor = 'todos';
      paint();
    }
  };
}
