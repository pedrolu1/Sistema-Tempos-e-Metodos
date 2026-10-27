// Gráficos em SVG puro: Curva S, previsto × realizado por semana e produção
// diária por etapa. Linhas finas, um eixo só, legenda e dica ao passar o mouse.
import { el, svg } from '../../../src/utils/dom.js';
import { ETAPAS } from '../data/obra.js';
import { curta } from '../lib/datas.js';

/**
 * O gráfico é redesenhado na largura real do cartão (o texto fica sempre do
 * mesmo tamanho, em vez de encolher junto com o SVG).
 */
function responsivo(construir, rotulo) {
  const caixa = el('div', { class: 'grafico', role: 'img', 'aria-label': rotulo });
  let ultimo = 0;
  const ro = new ResizeObserver((entradas) => {
    if (!caixa.isConnected) return ro.disconnect();
    const w = Math.round(entradas[0].contentRect.width);
    if (!w || Math.abs(w - ultimo) < 4) return;
    ultimo = w;
    caixa.replaceChildren(construir(Math.max(320, w)));
  });
  ro.observe(caixa);
  return caixa;
}
const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

let dica;
function mostrarDica(evt, titulo, linhas) {
  if (!dica) {
    dica = el('div', { class: 'dica-grafico', role: 'tooltip' });
    document.body.appendChild(dica);
  }
  dica.replaceChildren(
    el('strong', {}, titulo),
    ...linhas.map(([rot, val, cor]) => el('div', {}, [el('span', {}, [cor ? el('i', { style: { background: cor } }) : null, rot]), el('b', {}, val)]))
  );
  const x = Math.min(evt.clientX + 14, innerWidth - dica.offsetWidth - 10);
  const y = Math.max(10, evt.clientY - dica.offsetHeight - 12);
  dica.style.left = `${x}px`;
  dica.style.top = `${y}px`;
  dica.style.opacity = '1';
}
const esconderDica = () => dica && (dica.style.opacity = '0');

function eixoY(W, h, m, maxV, passos, fmt) {
  const nos = [];
  for (let i = 0; i <= passos; i++) {
    const v = (maxV / passos) * i;
    const y = h - m.b - ((h - m.t - m.b) * v) / maxV;
    nos.push(svg('line', { class: 'grade', x1: m.l, x2: W - m.r, y1: y, y2: y }));
    nos.push(svg('text', { class: 'eixo', x: m.l - 8, y: y + 4, 'text-anchor': 'end' }, fmt(v)));
  }
  return nos;
}

/** Curva S: previsto, replanejado, realizado (fornos) e físico ponderado, todos em % do escopo. */
export function graficoCurvaS(curva, { altura = 300 } = {}) {
  const temReplan = curva.pontos.some((p) => p.replanejado != null);
  return el('div', { class: 'pilha' }, [legendaSeries(seriesCurva(temReplan)), responsivo((W) => svgCurvaS(curva, W, altura), 'Curva S do contrato')]);
}

function seriesCurva(temReplan) {
  return [
    { id: 'prev', nome: 'Previsto', cor: 'var(--text-2)', tracejado: true, val: (p, e) => p.previstoAcum / e },
    temReplan ? { id: 'rep', nome: 'Replanejado', cor: 'var(--accent-300)', tracejado: true, val: (p, e) => p.replanejadoAcum / e } : null,
    { id: 'fis', nome: 'Físico pelas 6 etapas', cor: 'var(--text-0)', val: (p) => p.fisico },
    { id: 'real', nome: 'Realizado (fornos concluídos)', cor: 'var(--accent-400)', grosso: true, val: (p, e) => (p.realizadoAcum == null ? null : p.realizadoAcum / e) }
  ].filter(Boolean);
}

function svgCurvaS({ escopo, pontos }, W, altura) {
  const h = altura;
  const m = { t: 18, r: 54, b: 30, l: 44 };
  const n = pontos.length;
  const x = (i) => m.l + ((W - m.l - m.r) * i) / (n - 1);
  const y = (v) => h - m.b - (h - m.t - m.b) * v;
  const series = seriesCurva(pontos.some((p) => p.replanejado != null)).map((s) => ({ ...s, val: (p) => s.val(p, escopo) }));
  const passoRotulo = Math.max(1, Math.ceil(n / Math.floor((W - m.l - m.r) / 46)));
  const caminho = (s) => {
    let d = '';
    pontos.forEach((p, i) => {
      const v = s.val(p);
      if (v == null) return;
      d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    return d;
  };
  const iHoje = pontos.findIndex((p) => p.atual);
  const nos = [
    ...eixoY(W, h, m, 1, 4, (v) => `${Math.round(v * 100)}%`),
    ...pontos.map((p, i) => (i % passoRotulo === 0 ? svg('text', { class: 'eixo', x: x(i), y: h - 8, 'text-anchor': 'middle' }, p.semana) : null)),
    iHoje >= 0 ? svg('line', { class: 'hoje-linha', x1: x(iHoje), x2: x(iHoje), y1: m.t - 6, y2: h - m.b }) : null,
    iHoje >= 0 ? svg('text', { class: 'hoje-txt', x: x(iHoje) + 5, y: m.t + 2 }, 'hoje') : null,
    ...series.map((s) => svg('path', { d: caminho(s), fill: 'none', stroke: s.cor, 'stroke-width': s.grosso ? 2.6 : 2, 'stroke-dasharray': s.tracejado ? '5 5' : null, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }))
  ];
  // rótulos diretos no último ponto de cada série real
  for (const s of series.filter((q) => !q.tracejado)) {
    let ult = -1;
    pontos.forEach((p, i) => s.val(p) != null && (ult = i));
    if (ult < 0) continue;
    const v = s.val(pontos[ult]);
    nos.push(svg('circle', { cx: x(ult), cy: y(v), r: 4.5, fill: s.cor, stroke: 'var(--bg-2)', 'stroke-width': 2 }));
    nos.push(svg('text', { class: 'rotulo', x: x(ult) + 8, y: y(v) + (s.id === 'real' ? 16 : -8) }, pct(v)));
  }
  const mira = svg('line', { class: 'mira', x1: 0, x2: 0, y1: m.t, y2: h - m.b, visibility: 'hidden' });
  nos.push(mira);
  const passo = (W - m.l - m.r) / (n - 1);
  pontos.forEach((p, i) => {
    nos.push(svg('rect', {
      class: 'alvo', x: x(i) - passo / 2, y: m.t, width: passo, height: h - m.t - m.b,
      onmousemove: (e) => {
        mira.setAttribute('x1', x(i));
        mira.setAttribute('x2', x(i));
        mira.setAttribute('visibility', 'visible');
        mostrarDica(e, `${p.semana} · ${curta(p.inicio)} a ${curta(p.fim)}`, [
          ['Previsto', `${p.previstoAcum} fornos · ${pct(p.previstoAcum / escopo)}`, 'var(--text-2)'],
          p.replanejado != null ? ['Replanejado', `${p.replanejadoAcum} fornos`, 'var(--accent-300)'] : null,
          ['Realizado', p.realizadoAcum == null ? '—' : `${p.realizadoAcum} fornos · ${pct(p.realizadoAcum / escopo)}`, 'var(--accent-400)'],
          ['Físico', p.fisico == null ? '—' : pct(p.fisico), 'var(--text-0)']
        ].filter(Boolean));
      },
      onmouseleave: () => {
        mira.setAttribute('visibility', 'hidden');
        esconderDica();
      }
    }));
  });
  return svg('svg', { viewBox: `0 0 ${W} ${h}`, width: W, height: h }, nos);
}

function legendaSeries(series) {
  return el('div', { class: 'legenda-grafico' }, series.map((s) => el('span', { style: { color: s.cor } }, [el('i', { class: s.tracejado ? 'tracejado' : '', style: { background: s.cor } }), el('span', { style: { color: 'var(--text-1)' } }, s.nome)])));
}

/** Previsto × realizado por semana (fornos concluídos), barras lado a lado. */
export function graficoSemanal(curva, { altura = 220 } = {}) {
  return el('div', { class: 'pilha' }, [
    el('div', { class: 'legenda-grafico' }, [
      el('span', {}, [el('i', { style: { background: 'var(--bg-4)', outline: '1px solid var(--border-strong)', height: '10px', width: '12px' } }), 'Previsto']),
      el('span', {}, [el('i', { style: { background: 'var(--accent-500)', height: '10px', width: '12px' } }), 'Realizado'])
    ]),
    responsivo((W) => svgSemanal(curva, W, altura), 'Fornos concluídos por semana, previsto e realizado')
  ]);
}

function svgSemanal({ pontos }, W, altura) {
  const lista = pontos.filter((p) => p.previsto || p.realizado);
  const h = altura;
  const m = { t: 18, r: 12, b: 30, l: 34 };
  const maxV = Math.max(4, ...lista.map((p) => Math.max(p.previsto, p.realizado || 0)));
  const topo = Math.ceil(maxV / 5) * 5;
  const larg = (W - m.l - m.r) / lista.length;
  const barra = Math.min(16, (larg - 8) / 2);
  const y = (v) => h - m.b - ((h - m.t - m.b) * v) / topo;
  const nos = [...eixoY(W, h, m, topo, 5, (v) => String(Math.round(v)))];
  lista.forEach((p, i) => {
    const cx = m.l + larg * i + larg / 2;
    const r = 4;
    const bar = (v, x0, cor, contorno) => {
      if (!v) return null;
      const yy = y(v);
      const alt = h - m.b - yy;
      // cantos arredondados só em cima (dado ancorado na base)
      const d = `M${x0},${h - m.b}V${yy + r}Q${x0},${yy} ${x0 + r},${yy}H${x0 + barra - r}Q${x0 + barra},${yy} ${x0 + barra},${yy + r}V${h - m.b}Z`;
      return alt > 0 ? svg('path', { d, fill: cor, stroke: contorno || 'none', 'stroke-width': contorno ? 1.2 : 0 }) : null;
    };
    nos.push(bar(p.previsto, cx - barra - 1, 'var(--bg-4)', 'var(--border-strong)'));
    nos.push(bar(p.realizado, cx + 1, 'var(--accent-500)'));
    if (p.realizado) nos.push(svg('text', { class: 'rotulo', x: cx + 1 + barra / 2, y: y(p.realizado) - 5, 'text-anchor': 'middle' }, String(p.realizado)));
    if (i % Math.max(1, Math.ceil(46 / larg)) === 0) nos.push(svg('text', { class: 'eixo', x: cx, y: h - 9, 'text-anchor': 'middle' }, p.semana));
    nos.push(svg('rect', {
      class: 'alvo', x: cx - larg / 2, y: m.t, width: larg, height: h - m.t - m.b,
      onmousemove: (e) => mostrarDica(e, p.semana, [
        ['Previsto', `${p.previsto} fornos`, 'var(--bg-4)'],
        ['Realizado', p.realizado == null ? '—' : `${p.realizado} fornos`, 'var(--accent-500)'],
        ['Aderência', p.previsto && p.realizado != null ? pct(p.realizado / p.previsto) : '—']
      ]),
      onmouseleave: esconderDica
    }));
  });
  return svg('svg', { viewBox: `0 0 ${W} ${h}`, width: W, height: h }, nos);
}

/** Etapas concluídas por dia (primárias), empilhadas na ordem do serviço. */
export function graficoProducao(dados, { altura = 220 } = {}) {
  return responsivo((W) => svgProducao(dados, W, altura), 'Primárias por etapa, por dia');
}

function svgProducao({ dias, serie }, W, altura) {
  const h = altura;
  const m = { t: 14, r: 12, b: 30, l: 34 };
  const totais = dias.map((_, i) => serie.reduce((s, sr) => s + sr[i], 0));
  const topo = Math.max(10, Math.ceil(Math.max(...totais) / 10) * 10);
  const larg = (W - m.l - m.r) / dias.length;
  const bw = Math.max(4, larg - 4);
  const y = (v) => ((h - m.t - m.b) * v) / topo;
  const nos = [...eixoY(W, h, m, topo, 4, (v) => String(Math.round(v)))];
  dias.forEach((d, i) => {
    const x0 = m.l + larg * i + (larg - bw) / 2;
    let base = h - m.b;
    serie.forEach((sr, e) => {
      const v = sr[i];
      if (!v) return;
      const alt = y(v);
      // 2px de respiro entre segmentos, na cor do fundo
      nos.push(svg('rect', { x: x0, y: base - alt, width: bw, height: Math.max(1, alt - 2), rx: 2, fill: ETAPAS[e].cor }));
      base -= alt;
    });
    if (i % Math.max(1, Math.ceil(44 / larg)) === 0) nos.push(svg('text', { class: 'eixo', x: x0 + bw / 2, y: h - 9, 'text-anchor': 'middle' }, curta(d)));
    nos.push(svg('rect', {
      class: 'alvo', x: m.l + larg * i, y: m.t, width: larg, height: h - m.t - m.b,
      onmousemove: (e) => mostrarDica(e, curta(d), [...ETAPAS.map((et, k) => [et.curto, String(serie[k][i]), et.cor]).filter((l) => l[1] !== '0'), ['Total', `${totais[i]} primárias`]]),
      onmouseleave: esconderDica
    }));
  });
  return svg('svg', { viewBox: `0 0 ${W} ${h}`, width: W, height: h }, nos);
}
