import { el, mount } from '../../utils/dom.js';
import { cardWithHeader, button, segmented } from '../../components/ui.js';
import { statTile, meter, rankingBars, stackedTrend, stackedTrendN } from '../../components/charts.js';
import { icon } from '../../utils/icons.js';
import {
  formatMinutes,
  formatDateBR,
  todayISO,
  classificacaoDoLancamento,
  classificacaoBreakdown,
  excedenteMinutos,
  temDesperdicio,
  capacidadeMinutosSetor,
  CLASSIFICACAO_INFO
} from '../../utils/format.js';
import { exportExcel, exportPDF, exportWord } from '../../lib/export.js';

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
  const state = {
    preset: '30d',
    setor: 'todos',
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
  const atividadesCard = el('div');
  const improdCard = el('div');
  const lideresCard = el('div');

  const exportBtns = el('div', { class: 'toolbar' }, [
    button({ label: 'Excel', size: 'sm', variant: 'outline', icon: icon.fileSpreadsheet(15), onClick: () => exportExcel(dataset()) }),
    button({ label: 'PDF', size: 'sm', variant: 'outline', icon: icon.fileText(15), onClick: () => exportPDF(dataset(), undefined, { periodo: periodoLabel() }) }),
    button({ label: 'Word', size: 'sm', variant: 'outline', icon: icon.fileWord(15), onClick: () => exportWord(dataset(), undefined, { periodo: periodoLabel() }) })
  ]);

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

  function buildSetorFilter() {
    if (setores.length === 0) {
      mount(setorRow, []);
      return;
    }
    const sel = el(
      'select',
      {
        class: 'select',
        style: { height: '34px', fontSize: '12.5px', minWidth: '190px' },
        onchange: (e) => { state.setor = e.target.value; paint(); }
      },
      [
        el('option', { value: 'todos', selected: state.setor === 'todos' }, 'Todos os setores'),
        ...setores.map((s) => el('option', { value: s.nome, selected: s.nome === state.setor }, s.nome))
      ]
    );
    mount(setorRow, [el('span', { class: 'section-title', style: { padding: '0' } }, 'Setor'), sel]);
  }

  const node = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } }, [
    el('div', { class: 'page-header' }, [
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [filterRow, setorRow, chipsRow]),
      exportBtns
    ]),
    kpiRow,
    el('div', { class: 'grid grid-charts' }, [trendCard, meterCard]),
    leanCard,
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

  function paintKpis() {
    const full = dataset();
    const totalMin = full.reduce((s, l) => s + l.duracaoMinutos, 0);
    const prodMin = full.filter((l) => l.tipoRegistro === 'atividade').reduce((s, l) => s + l.duracaoMinutos, 0);
    const improdMin = full.filter((l) => l.tipoRegistro === 'improdutividade').reduce((s, l) => s + l.duracaoMinutos, 0);

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
      statTile({ label: 'Lançamentos no período', value: String(full.length), iconHtml: icon.list(16) })
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

  function paintTrend() {
    const rows = dataset();
    const byDay = new Map();
    rows.forEach((l) => {
      if (!byDay.has(l.data)) byDay.set(l.data, { a: 0, b: 0 });
      const e = byDay.get(l.data);
      if (l.tipoRegistro === 'atividade') e.a += l.duracaoMinutos;
      else e.b += l.duracaoMinutos;
    });
    const days = [...byDay.keys()].sort();
    const data = days.map((d) => ({
      key: d,
      label: d.slice(8, 10) + '/' + d.slice(5, 7),
      fullLabel: formatDateBR(d),
      a: byDay.get(d).a,
      b: byDay.get(d).b
    }));

    mount(trendCard, [
      cardWithHeader({
        title: 'Produtivo x Improdutivo por dia',
        subtitle: periodoLabel(),
        children: data.length ? [stackedTrend({ data })] : [el('div', { style: { padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' } }, 'Sem lançamentos no período selecionado.')]
      })
    ]);
  }

  function paintLean() {
    const full = dataset();
    const byClass = { VA: 0, DN: 0, DNN: 0 };
    full.forEach((l) => {
      const b = classificacaoBreakdown(l);
      byClass.VA += b.VA;
      byClass.DN += b.DN;
      byClass.DNN += b.DNN;
    });

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

    const byDay = new Map();
    full.forEach((l) => {
      if (!byDay.has(l.data)) byDay.set(l.data, { VA: 0, DN: 0, DNN: 0 });
      const e = byDay.get(l.data);
      const b = classificacaoBreakdown(l);
      e.VA += b.VA;
      e.DN += b.DN;
      e.DNN += b.DNN;
    });
    const days = [...byDay.keys()].sort();
    const trendData = days.map((d) => ({
      key: d,
      label: d.slice(8, 10) + '/' + d.slice(5, 7),
      fullLabel: formatDateBR(d),
      ...byDay.get(d)
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

  function paintInsights() {
    const full = dataset();
    const totalMin = full.reduce((s, l) => s + l.duracaoMinutos, 0);
    const byClass = { VA: 0, DN: 0, DNN: 0 };
    full.forEach((l) => {
      const b = classificacaoBreakdown(l);
      byClass.VA += b.VA;
      byClass.DN += b.DN;
      byClass.DNN += b.DNN;
    });
    const pct = (v) => (totalMin > 0 ? Math.round((v / totalMin) * 100) : 0);

    // maior improdutividade evitável (DNN) por item
    const dnnMap = new Map();
    full.filter((l) => classificacaoDoLancamento(l) === 'DNN').forEach((l) => {
      dnnMap.set(l.atividadeNome, (dnnMap.get(l.atividadeNome) || 0) + l.duracaoMinutos);
    });
    const topDNN = [...dnnMap.entries()].sort((a, b) => b[1] - a[1])[0];

    // atividade que mais estoura o padrão
    const exMap = new Map();
    full.forEach((l) => {
      const ex = excedenteMinutos(l);
      if (ex > 0) exMap.set(l.atividadeNome, (exMap.get(l.atividadeNome) || 0) + ex);
    });
    const topEx = [...exMap.entries()].sort((a, b) => b[1] - a[1])[0];

    const insights = [];
    if (totalMin === 0) {
      insights.push({ tone: 'neutral', txt: 'Sem lançamentos no período/filtros atuais.' });
    } else {
      insights.push({
        tone: pct(byClass.VA) >= 50 ? 'ok' : pct(byClass.VA) >= 30 ? 'warn' : 'danger',
        txt: `Valor Agregado representa ${pct(byClass.VA)}% do tempo. ${pct(byClass.VA) >= 50 ? 'Bom patamar — mantenha o padrão.' : 'Há espaço para converter desperdício em valor.'}`
      });
      if (pct(byClass.DNN) >= 15) {
        insights.push({ tone: 'danger', txt: `Desperdício Não Necessário está em ${pct(byClass.DNN)}% — foco de eliminação imediata.` });
      }
      if (topDNN) {
        insights.push({ tone: 'danger', txt: `Maior desperdício evitável: “${topDNN[0]}” (${formatMinutes(topDNN[1])}). Ataque a causa raiz dessa parada.` });
      }
      if (topEx) {
        insights.push({ tone: 'warn', txt: `“${topEx[0]}” é a atividade que mais passa do tempo padrão (${formatMinutes(topEx[1])} de excedente). Reveja método, sequência ou dimensionamento da equipe.` });
      }
      if (pct(byClass.DN) >= 40) {
        insights.push({ tone: 'warn', txt: `Desperdício Necessário em ${pct(byClass.DN)}% — parte é inevitável, mas questione se todo acesso/preparo é realmente necessário (Lean: eliminar, combinar, simplificar).` });
      }
      if (pct(byClass.VA) >= 55 && pct(byClass.DNN) < 10) {
        insights.push({ tone: 'ok', txt: 'Processo saudável: alto valor agregado e pouco desperdício evitável. Padronize o que está dando certo.' });
      }
    }

    mount(insightsCard, [
      cardWithHeader({
        title: 'Insights & sugestões',
        subtitle: 'Leitura automática do período aplicando princípios Lean',
        children: [
          el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, insights.map((i) => {
            const color = i.tone === 'ok' ? 'var(--ok-500)' : i.tone === 'warn' ? 'var(--warn-500)' : i.tone === 'danger' ? 'var(--danger-500)' : 'var(--text-3)';
            return el('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', lineHeight: '1.5' } }, [
              el('span', { html: icon.lightbulb(16), style: { display: 'inline-flex', color, flexShrink: '0', marginTop: '1px' } }),
              el('span', { style: { color: 'var(--text-1)' } }, i.txt)
            ]);
          }))
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
    paintKpis();
    paintTrend();
    paintLean();
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
      if (state.setor !== 'todos' && !setores.some((s) => s.nome === state.setor)) state.setor = 'todos';
      paint();
    }
  };
}
