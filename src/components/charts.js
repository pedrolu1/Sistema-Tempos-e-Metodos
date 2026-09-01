import { el, svg } from '../utils/dom.js';
import { formatMinutes } from '../utils/format.js';
import { icon } from '../utils/icons.js';

let tooltipEl;
function tooltip() {
  if (!tooltipEl) {
    tooltipEl = el('div', {
      class: 'chart-tooltip',
      style: {
        position: 'fixed',
        zIndex: '500',
        pointerEvents: 'none',
        background: 'var(--bg-4)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--r-sm)',
        padding: '8px 11px',
        fontSize: '12px',
        boxShadow: 'var(--shadow-md)',
        opacity: '0',
        transition: 'opacity 100ms ease',
        maxWidth: '220px'
      }
    });
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function showTooltip(evt, rows) {
  const t = tooltip();
  const body = document.createElement('div');
  rows.forEach(([label, value, color]) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '7px';
    row.style.whiteSpace = 'nowrap';
    if (color) {
      const key = document.createElement('span');
      key.style.width = '9px';
      key.style.height = '2px';
      key.style.background = color;
      key.style.flexShrink = '0';
      row.appendChild(key);
    }
    const lab = document.createElement('span');
    lab.style.color = 'var(--text-2)';
    lab.textContent = label;
    const val = document.createElement('strong');
    val.style.marginLeft = 'auto';
    val.style.fontFamily = 'var(--font-mono)';
    val.style.color = 'var(--text-0)';
    val.textContent = value;
    row.appendChild(lab);
    row.appendChild(val);
    body.appendChild(row);
  });
  t.innerHTML = '';
  t.appendChild(body);
  t.style.opacity = '1';
  moveTooltip(evt);
}
function moveTooltip(evt) {
  const t = tooltip();
  const x = evt.clientX + 16;
  const y = evt.clientY + 16;
  t.style.left = `${Math.min(x, window.innerWidth - 240)}px`;
  t.style.top = `${Math.min(y, window.innerHeight - 80)}px`;
}
function hideTooltip() {
  if (tooltipEl) tooltipEl.style.opacity = '0';
}

/** KPI clicável — funciona como filtro (toggle) quando onToggle é passado. */
export function statTile({ label, value, iconHtml, tone = 'accent', active = false, onToggle, trend }) {
  const card = el(
    'div',
    { class: `kpi-card${active ? ' active' : ''}`, onclick: onToggle ? () => onToggle() : null, style: { cursor: onToggle ? 'pointer' : 'default' } },
    [
      el('div', { class: 'kpi-label' }, [iconHtml ? el('span', { html: iconHtml, style: { display: 'inline-flex', color: `var(--${tone}-500, var(--accent-500))` } }) : null, label]),
      el('div', { class: 'kpi-value' }, value),
      trend ? el('div', { class: `kpi-trend ${trend.dir}` }, [el('span', { html: trend.dir === 'up' ? icon.arrowUp(13) : icon.arrowDown(13) }), trend.text]) : null
    ]
  );
  return card;
}

/** Barra de progresso (meter) — mede uma razão única contra o total. */
export function meter({ label, ratio, valueLabel, color = 'var(--accent-500)', track = 'var(--bg-4)' }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [
    el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-2)', fontWeight: '600' } }, [label, el('span', { class: 'mono', style: { color: 'var(--text-0)' } }, valueLabel)]),
    el('div', { style: { height: '10px', borderRadius: 'var(--r-full)', background: track, overflow: 'hidden' } }, [
      el('div', { style: { height: '100%', width: `${pct}%`, background: color, borderRadius: 'var(--r-full)', transition: 'width 420ms var(--ease-out)' } })
    ])
  ]);
}

/**
 * Ranking horizontal de série única (nominal categórica) — todas as barras na
 * mesma cor: o comprimento é quem carrega o valor, a cor não recodifica nada.
 */
export function rankingBars({ data, color = 'var(--accent-500)', valueFmt = formatMinutes, activeId, onSelect, emptyLabel = 'Sem dados no período.' }) {
  if (!data.length) {
    return el('div', { style: { padding: '28px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' } }, emptyLabel);
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return el(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
    data.map((d) => {
      const pct = Math.max((d.value / max) * 100, 3);
      const isActive = activeId && d.id === activeId;
      const isDimmed = activeId && !isActive;
      const row = el(
        'div',
        {
          style: { cursor: onSelect ? 'pointer' : 'default', opacity: isDimmed ? '0.45' : '1', transition: 'opacity 160ms ease' },
          onclick: onSelect ? () => onSelect(d.id) : null,
          onmouseenter: (e) => showTooltip(e, [[d.label, valueFmt(d.value)]]),
          onmousemove: moveTooltip,
          onmouseleave: hideTooltip
        },
        [
          el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '5px' } }, [
            el('span', { style: { color: 'var(--text-1)', fontWeight: isActive ? '700' : '500' } }, d.label),
            el('span', { class: 'mono', style: { color: 'var(--text-2)' } }, valueFmt(d.value))
          ]),
          el('div', { style: { height: '10px', borderRadius: '4px', background: 'var(--bg-4)', overflow: 'hidden' } }, [
            el('div', { style: { height: '100%', width: `${pct}%`, background: isActive ? color : color, opacity: isActive ? '1' : '0.85', borderRadius: '4px 0 0 4px', transition: 'width 420ms var(--ease-out)' } })
          ])
        ]
      );
      return row;
    })
  );
}

/**
 * Colunas empilhadas (produtivo x improdutivo) por categoria (dia/semana).
 * Duas séries -> legenda sempre visível; gap de 2px na cor da superfície
 * separando os segmentos.
 */
export function stackedTrend({ data, seriesA, seriesB, onSelect, activeKey }) {
  const W = 640;
  const H = 220;
  const padL = 40;
  const padB = 26;
  const padT = 10;
  const innerW = W - padL - 12;
  const innerH = H - padT - padB;
  const max = Math.max(...data.map((d) => d.a + d.b), 1);
  const niceMax = niceCeil(max);
  const bandW = innerW / data.length;
  const barW = Math.min(24, bandW * 0.55);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = padT + innerH * (1 - t);
    return svg('g', {}, [
      svg('line', { x1: padL, x2: W - 6, y1: y, y2: y, stroke: 'var(--chart-grid)', 'stroke-width': '1' }),
      svg('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--text-3)', 'font-size': '10' }, formatMinutes(niceMax * t))
    ]);
  });

  const bars = data.map((d, i) => {
    const cx = padL + bandW * i + bandW / 2;
    const total = d.a + d.b;
    const hA = innerH * (d.a / niceMax);
    const hB = innerH * (d.b / niceMax);
    const yBase = padT + innerH;
    const gap = d.a > 0 && d.b > 0 ? 2 : 0;
    const isActive = !activeKey || activeKey === d.key;

    const group = svg('g', { style: `cursor:${onSelect ? 'pointer' : 'default'}; opacity:${isActive ? 1 : 0.35}; transition: opacity 160ms ease;` }, [
      d.b > 0 ? svg('rect', { x: cx - barW / 2, y: yBase - hB, width: barW, height: Math.max(hB, 0), rx: '4', fill: 'var(--danger-500)' }) : null,
      d.a > 0
        ? svg('rect', {
            x: cx - barW / 2,
            y: yBase - hB - gap - hA,
            width: barW,
            height: Math.max(hA, 0),
            rx: '4',
            fill: 'var(--ok-500)'
          })
        : null,
      svg('rect', { x: cx - barW / 2 - 4, y: padT, width: barW + 8, height: innerH, fill: 'transparent' }),
      svg('text', { x: cx, y: H - 8, 'text-anchor': 'middle', fill: 'var(--text-3)', 'font-size': '10' }, d.label)
    ]);
    group.addEventListener('mouseenter', (e) =>
      showTooltip(e, [
        [d.fullLabel || d.label, ''],
        ['Produtivo', formatMinutes(d.a), 'var(--ok-500)'],
        ['Improdutivo', formatMinutes(d.b), 'var(--danger-500)']
      ])
    );
    group.addEventListener('mousemove', moveTooltip);
    group.addEventListener('mouseleave', hideTooltip);
    if (onSelect) group.addEventListener('click', () => onSelect(d.key));
    return group;
  });

  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, style: 'display:block; overflow: visible;' }, [...gridLines, ...bars]);

  return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
    chart,
    el('div', { style: { display: 'flex', gap: '18px', fontSize: '12px', color: 'var(--text-2)' } }, [
      legendKey('var(--ok-500)', seriesA || 'Produtivo'),
      legendKey('var(--danger-500)', seriesB || 'Improdutivo')
    ])
  ]);
}

/**
 * Colunas empilhadas de N séries (usado pra VA/DN/DNN) — mesma linguagem
 * visual do stackedTrend, generalizada em vez de fixar exatamente 2 campos.
 * `series`: [{ key, label, color }]; cada ponto de `data` traz um valor por
 * `key` além de `label`/`fullLabel`.
 */
export function stackedTrendN({ data, series, onSelect, activeKey }) {
  const W = 640;
  const H = 220;
  const padL = 40;
  const padB = 26;
  const padT = 10;
  const innerW = W - padL - 12;
  const innerH = H - padT - padB;
  const totalOf = (d) => series.reduce((s, ser) => s + (d[ser.key] || 0), 0);
  const max = Math.max(...data.map(totalOf), 1);
  const niceMax = niceCeil(max);
  const bandW = innerW / data.length;
  const barW = Math.min(24, bandW * 0.55);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = padT + innerH * (1 - t);
    return svg('g', {}, [
      svg('line', { x1: padL, x2: W - 6, y1: y, y2: y, stroke: 'var(--chart-grid)', 'stroke-width': '1' }),
      svg('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--text-3)', 'font-size': '10' }, formatMinutes(niceMax * t))
    ]);
  });

  const bars = data.map((d) => {
    const idx = data.indexOf(d);
    const cx = padL + bandW * idx + bandW / 2;
    const yBase = padT + innerH;
    const isActive = !activeKey || activeKey === d.key;
    let cursor = 0;

    const segments = series.map((ser, i) => {
      const val = d[ser.key] || 0;
      const h = innerH * (val / niceMax);
      const gap = i > 0 && val > 0 ? 2 : 0;
      cursor += gap;
      const y = yBase - cursor - h;
      cursor += h;
      return val > 0 ? svg('rect', { x: cx - barW / 2, y, width: barW, height: Math.max(h, 0), rx: '4', fill: ser.color }) : null;
    });

    const group = svg('g', { style: `cursor:${onSelect ? 'pointer' : 'default'}; opacity:${isActive ? 1 : 0.35}; transition: opacity 160ms ease;` }, [
      ...segments,
      svg('rect', { x: cx - barW / 2 - 4, y: padT, width: barW + 8, height: innerH, fill: 'transparent' }),
      svg('text', { x: cx, y: H - 8, 'text-anchor': 'middle', fill: 'var(--text-3)', 'font-size': '10' }, d.label)
    ]);
    group.addEventListener('mouseenter', (e) =>
      showTooltip(e, [[d.fullLabel || d.label, ''], ...series.map((ser) => [ser.label, formatMinutes(d[ser.key] || 0), ser.color])])
    );
    group.addEventListener('mousemove', moveTooltip);
    group.addEventListener('mouseleave', hideTooltip);
    if (onSelect) group.addEventListener('click', () => onSelect(d.key));
    return group;
  });

  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, style: 'display:block; overflow: visible;' }, [...gridLines, ...bars]);

  return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
    chart,
    el('div', { style: { display: 'flex', gap: '18px', fontSize: '12px', color: 'var(--text-2)', flexWrap: 'wrap' } }, series.map((ser) => legendKey(ser.color, ser.label)))
  ]);
}

function legendKey(color, label) {
  return el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '7px' } }, [
    el('span', { style: { width: '10px', height: '10px', borderRadius: '3px', background: color, display: 'inline-block' } }),
    label
  ]);
}

function niceCeil(v) {
  if (v <= 0) return 60;
  const magnitude = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / magnitude;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * magnitude;
}
