import { el, mount } from '../../utils/dom.js';
import { cardWithHeader, button, segmented } from '../../components/ui.js';
import { statTile, meter, rankingBars, stackedTrend, stackedTrendN } from '../../components/charts.js';
import { icon } from '../../utils/icons.js';
import { formatMinutes, formatDateBR, todayISO, classificacaoDoLancamento, CLASSIFICACAO_INFO } from '../../utils/format.js';
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
  const state = {
    preset: '30d',
    filters: { tipo: null, atividadeId: null, liderId: null, classificacao: null }
  };

  const filterRow = el('div', { class: 'toolbar' });
  const chipsRow = el('div', { class: 'toolbar', style: { minHeight: '20px' } });
  const kpiRow = el('div', { class: 'grid grid-kpis' });
  const meterCard = el('div');
  const trendCard = el('div');
  const leanCard = el('div');
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

  const node = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } }, [
    el('div', { class: 'page-header' }, [
      el('div', {}, [filterRow, chipsRow]),
      exportBtns
    ]),
    kpiRow,
    el('div', { class: 'grid grid-charts' }, [trendCard, meterCard]),
    leanCard,
    el('div', { class: 'grid grid-2' }, [atividadesCard, improdCard]),
    lideresCard
  ]);

  function periodoLabel() {
    if (state.preset === 'tudo') return 'todo o período';
    if (state.preset === 'hoje') return `hoje (${formatDateBR(todayISO())})`;
    return `últimos ${PRESETS[state.preset] + 1} dias`;
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
      byClass[classificacaoDoLancamento(l)] += l.duracaoMinutos;
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
      byDay.get(l.data)[classificacaoDoLancamento(l)] += l.duracaoMinutos;
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
    const rows = dataset(['liderId']);
    const data = aggregateBy(rows, 'liderId', 'liderNome');
    mount(lideresCard, [
      cardWithHeader({
        title: 'Ranking de líderes',
        subtitle: 'Tempo total registrado sob liderança de cada colaborador — clique para filtrar',
        children: [rankingBars({ data, color: 'var(--accent-500)', activeId: state.filters.liderId, onSelect: (id) => toggleFilter('liderId', id) })]
      })
    ]);
  }

  function paint() {
    paintChips();
    paintKpis();
    paintTrend();
    paintLean();
    paintAtividades();
    paintImprod();
    paintLideres();
  }

  paint();

  return {
    node,
    update(newCtx) {
      lancamentos = newCtx.lancamentos;
      paint();
    }
  };
}
