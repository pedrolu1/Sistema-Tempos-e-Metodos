// Gráficos em SVG puro: Curva S do BM, fornos por BM e produção diária por
// etapa. Linhas finas, um eixo só, legenda e dica ao passar o mouse.
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

/**
 * Curva S do BM (revestimento, em fornos): por semana, a meta e o realizado em
 * barras, e o acumulado de cada um em linha. A semana atual fica num
 * retângulo grande, para bater o olho e saber onde estamos.
 */
export function graficoCurvaBm(curva, { altura = 300 } = {}) {
  return el('div', { class: 'pilha' }, [
    el('div', { class: 'legenda-grafico' }, [
      el('span', {}, [el('i', { style: { background: 'var(--bg-4)', outline: '1px solid var(--border-strong)', height: '10px', width: '12px' } }), 'Meta da semana']),
      el('span', {}, [el('i', { style: { background: 'var(--accent-500)', height: '10px', width: '12px' } }), 'Revestidos na semana']),
      el('span', { style: { color: 'var(--text-2)' } }, [el('i', { class: 'tracejado', style: { background: 'var(--text-2)' } }), el('span', { style: { color: 'var(--text-1)' } }, 'Meta acumulada')]),
      el('span', { style: { color: 'var(--e-massa1200)' } }, [el('i', { style: { background: 'var(--e-massa1200)' } }), el('span', { style: { color: 'var(--text-1)' } }, 'Realizado acumulado')])
    ]),
    responsivo((W) => svgCurvaBm(curva, W, altura), `Curva S do BM ${curva.bm}`)
  ]);
}

function svgCurvaBm({ pontos, meta, realizado }, W, altura) {
  const h = altura;
  const m = { t: 34, r: 40, b: 40, l: 34 };
  const n = pontos.length;
  const topo = Math.max(6, Math.ceil(Math.max(meta, realizado) / 6) * 6);
  const larg = (W - m.l - m.r) / n;
  const barra = Math.min(30, (larg - 18) / 2);
  const cx = (i) => m.l + larg * i + larg / 2;
  const y = (v) => h - m.b - ((h - m.t - m.b) * v) / topo;
  const nos = [];
  // retângulo grande da semana atual (atrás de tudo)
  const iAtual = pontos.findIndex((p) => p.atual);
  if (iAtual >= 0) {
    nos.push(svg('rect', { class: 'semana-atual', x: m.l + larg * iAtual + 3, y: 4, width: larg - 6, height: h - 8, rx: 14 }));
    nos.push(svg('text', { class: 'semana-atual-txt', x: cx(iAtual), y: 22, 'text-anchor': 'middle' }, 'SEMANA ATUAL'));
  }
  nos.push(...eixoY(W, h, m, topo, 6, (v) => String(Math.round(v))));
  const r = 4;
  const bar = (v, x0, cor, contorno) => {
    if (!v) return null;
    const yy = y(v);
    const d = `M${x0},${h - m.b}V${yy + r}Q${x0},${yy} ${x0 + r},${yy}H${x0 + barra - r}Q${x0 + barra},${yy} ${x0 + barra},${yy + r}V${h - m.b}Z`;
    return svg('path', { d, fill: cor, stroke: contorno || 'none', 'stroke-width': contorno ? 1.2 : 0 });
  };
  pontos.forEach((p, i) => {
    const c = cx(i);
    nos.push(bar(p.meta, c - barra - 2, 'var(--bg-4)', 'var(--border-strong)'));
    if (p.realizado != null) {
      nos.push(bar(p.realizado, c + 2, p.realizado >= p.meta && p.meta ? 'var(--e-massa1200)' : 'var(--accent-500)'));
      nos.push(svg('text', { class: 'rotulo', x: c + 2 + barra / 2, y: (p.realizado ? y(p.realizado) : h - m.b) - 6, 'text-anchor': 'middle' }, String(p.realizado)));
    }
    nos.push(svg('text', { class: `eixo${p.atual ? ' forte' : ''}`, x: c, y: h - 22, 'text-anchor': 'middle' }, p.semana));
    nos.push(svg('text', { class: 'eixo fino', x: c, y: h - 8, 'text-anchor': 'middle' }, `${curta(p.ini)}–${curta(p.fim)}`));
  });
  // acumulados
  const linha = (campo, cor, tracejado) => {
    let d = '';
    pontos.forEach((p, i) => {
      if (p[campo] == null) return;
      d += `${d ? 'L' : 'M'}${cx(i).toFixed(1)},${y(p[campo]).toFixed(1)}`;
    });
    return svg('path', { d, fill: 'none', stroke: cor, 'stroke-width': tracejado ? 2 : 2.6, 'stroke-dasharray': tracejado ? '5 5' : null, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  };
  nos.push(linha('metaAcum', 'var(--text-2)', true));
  nos.push(linha('realizadoAcum', 'var(--e-massa1200)', false));
  const ultMeta = pontos.length - 1;
  nos.push(svg('text', { class: 'rotulo fraco', x: cx(ultMeta) + 8, y: y(pontos[ultMeta].metaAcum) + 4 }, String(pontos[ultMeta].metaAcum)));
  let ult = -1;
  pontos.forEach((p, i) => p.realizadoAcum != null && (ult = i));
  if (ult >= 0) {
    const v = pontos[ult].realizadoAcum;
    nos.push(svg('circle', { cx: cx(ult), cy: y(v), r: 5, fill: 'var(--e-massa1200)', stroke: 'var(--bg-2)', 'stroke-width': 2 }));
    nos.push(svg('text', { class: 'rotulo', x: cx(ult) + barra + 10, y: y(v) - 10 }, `${v} acum.`));
  }
  pontos.forEach((p, i) => {
    nos.push(svg('rect', {
      class: 'alvo', x: m.l + larg * i, y: m.t, width: larg, height: h - m.t - m.b,
      onmousemove: (e) => mostrarDica(e, `${p.semana} · ${curta(p.ini)} a ${curta(p.fim)}`, [
        ['Meta da semana', `${p.meta} fornos`, 'var(--bg-4)'],
        ['Revestidos', p.realizado == null ? 'semana futura' : `${p.realizado} fornos`, 'var(--accent-500)'],
        ['Meta acumulada', `${p.metaAcum}`, 'var(--text-2)'],
        ['Realizado acumulado', p.realizadoAcum == null ? '—' : `${p.realizadoAcum}`, 'var(--e-massa1200)'],
        p.fornos?.length ? ['Fornos', p.fornos.map((f) => f.replace('-', ' ')).join(', ')] : null
      ].filter(Boolean)),
      onmouseleave: esconderDica
    }));
  });
  return svg('svg', { viewBox: `0 0 ${W} ${h}`, width: W, height: h }, nos);
}

/** Fornos revestidos por BM contra a meta do BM. */
export function graficoBms(lista, { altura = 220 } = {}) {
  return el('div', { class: 'pilha' }, [
    el('div', { class: 'legenda-grafico' }, [
      el('span', {}, [el('i', { style: { background: 'var(--bg-4)', outline: '1px solid var(--border-strong)', height: '10px', width: '12px' } }), 'Meta do BM']),
      el('span', {}, [el('i', { style: { background: 'var(--accent-500)', height: '10px', width: '12px' } }), 'Revestidos'])
    ]),
    responsivo((W) => svgBms(lista, W, altura), 'Fornos revestidos por BM')
  ]);
}

function svgBms(lista, W, altura) {
  const h = altura;
  const m = { t: 18, r: 12, b: 30, l: 34 };
  const topo = Math.max(6, Math.ceil(Math.max(...lista.map((b) => Math.max(b.meta, b.realizado))) / 6) * 6);
  const larg = (W - m.l - m.r) / Math.max(1, lista.length);
  const barra = Math.min(26, (larg - 12) / 2);
  const y = (v) => h - m.b - ((h - m.t - m.b) * v) / topo;
  const nos = [...eixoY(W, h, m, topo, 6, (v) => String(Math.round(v)))];
  const r = 4;
  const bar = (v, x0, cor, contorno) => {
    if (!v) return null;
    const yy = y(v);
    const d = `M${x0},${h - m.b}V${yy + r}Q${x0},${yy} ${x0 + r},${yy}H${x0 + barra - r}Q${x0 + barra},${yy} ${x0 + barra},${yy + r}V${h - m.b}Z`;
    return svg('path', { d, fill: cor, stroke: contorno || 'none', 'stroke-width': contorno ? 1.2 : 0 });
  };
  lista.forEach((b, i) => {
    const c = m.l + larg * i + larg / 2;
    nos.push(bar(b.meta, c - barra - 1, 'var(--bg-4)', 'var(--border-strong)'));
    nos.push(bar(b.realizado, c + 1, b.realizado >= b.meta ? 'var(--e-massa1200)' : 'var(--accent-500)'));
    nos.push(svg('text', { class: 'rotulo', x: c + 1 + barra / 2, y: y(b.realizado) - 5, 'text-anchor': 'middle' }, String(b.realizado)));
    nos.push(svg('text', { class: `eixo${b.atual ? ' forte' : ''}`, x: c, y: h - 9, 'text-anchor': 'middle' }, b.rotulo));
    nos.push(svg('rect', {
      class: 'alvo', x: c - larg / 2, y: m.t, width: larg, height: h - m.t - m.b,
      onmousemove: (e) => mostrarDica(e, `BM ${b.rotulo} · ${curta(b.inicio)} a ${curta(b.fim)}`, [
        ['Meta', `${b.meta} fornos`, 'var(--bg-4)'],
        ['Revestidos', `${b.realizado} fornos`, 'var(--accent-500)'],
        ['Aderência', b.meta ? pct(b.realizado / b.meta) : '—']
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
