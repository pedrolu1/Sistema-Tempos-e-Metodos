// Peças pequenas usadas no campo e no painel.
import { el, svg } from '../../../src/utils/dom.js';
import { ic } from '../lib/icones.js';
import { ETAPAS, fornoPorId, primariaPorId } from '../data/obra.js';

/** Folha que sobe de baixo (no computador vira um modal no centro). Devolve { fechar }. */
export function abrirFolha({ titulo, subtitulo = '', corpo, pe = null, aoFechar = null, classe = '' }) {
  const caixa = el('div', { class: `folha ${classe}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': typeof titulo === 'string' ? titulo : '' });
  const fundo = el('div', { class: 'folha-fundo' }, caixa);
  let fechada = false;
  const fechar = () => {
    if (fechada) return;
    fechada = true;
    caixa.classList.add('saindo');
    document.removeEventListener('keydown', esc);
    setTimeout(() => fundo.remove(), 230);
    aoFechar?.();
  };
  const esc = (e) => e.key === 'Escape' && fechar();
  const topoTitulo = el('div', {}, [el('h3', {}, titulo), subtitulo ? el('small', {}, subtitulo) : null]);
  // ao redesenhar o mesmo passo a rolagem fica onde estava; `topo` volta para o início
  const montar = ({ titulo: t, subtitulo: s, corpo: c, pe: p, topo = false }) => {
    const rolagem = topo ? 0 : caixa.querySelector('.folha-corpo')?.scrollTop || 0;
    if (t !== undefined) topoTitulo.firstChild.textContent = t;
    if (s !== undefined) {
      topoTitulo.querySelector('small')?.remove();
      if (s) topoTitulo.appendChild(el('small', {}, s));
    }
    caixa.replaceChildren(...[
      el('div', { class: 'folha-alca' }),
      el('div', { class: 'folha-topo' }, [topoTitulo, el('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': 'Fechar', onclick: fechar, html: ic.x(18) })]),
      el('div', { class: 'folha-corpo' }, c),
      p && (!Array.isArray(p) || p.length) ? el('div', { class: 'folha-pe' }, p) : null
    ].filter(Boolean));
    caixa.querySelector('.folha-corpo').scrollTop = rolagem;
  };
  montar({ corpo, pe });
  fundo.addEventListener('click', (e) => e.target === fundo && fechar());
  document.addEventListener('keydown', esc);
  document.body.appendChild(fundo);
  return { fechar, montar, caixa };
}

/** Anel de progresso com o gradiente da brasa. Com `chave`, anima a partir do último valor mostrado. */
const ultimosAneis = new Map();
export function anel({ fracao, tamanho = 132, espessura = 12, centro, chave = null }) {
  const de = chave && ultimosAneis.has(chave) ? ultimosAneis.get(chave) : 0;
  if (chave) ultimosAneis.set(chave, fracao);
  const r = (tamanho - espessura) / 2;
  const circ = 2 * Math.PI * r;
  const arco = svg('circle', { class: 'arco', cx: tamanho / 2, cy: tamanho / 2, r, fill: 'none', 'stroke-width': espessura, 'stroke-linecap': 'round', 'stroke-dasharray': circ, 'stroke-dashoffset': circ * (1 - Math.max(0, Math.min(1, de))) });
  const no = el('div', { class: 'anel', style: { width: `${tamanho}px`, height: `${tamanho}px` } }, [
    svg('svg', { width: tamanho, height: tamanho, viewBox: `0 0 ${tamanho} ${tamanho}` }, [
      svg('defs', {}, svg('linearGradient', { id: 'grad-brasa', x1: '0', y1: '0', x2: '1', y2: '1' }, [
        svg('stop', { offset: '0%', 'stop-color': '#ff5a14' }),
        svg('stop', { offset: '60%', 'stop-color': '#ff8a1f' }),
        svg('stop', { offset: '100%', 'stop-color': '#ffb02e' })
      ])),
      svg('circle', { class: 'trilho', cx: tamanho / 2, cy: tamanho / 2, r, fill: 'none', 'stroke-width': espessura }),
      arco
    ]),
    el('div', { class: 'anel-centro' }, centro)
  ]);
  // anima até o valor assim que entra na tela
  requestAnimationFrame(() => requestAnimationFrame(() => arco.setAttribute('stroke-dashoffset', String(circ * (1 - Math.max(0, Math.min(1, fracao)))))));
  return no;
}

/** Uma célula de primária pintada pela etapa mais avançada (número = etapa). */
export function cel(nivel, { nova = false, apagada = false, titulo = '' } = {}) {
  return el('span', { class: `cel ${nivel < 0 ? 'vazia' : `n${nivel}`}${nova ? ' nova' : ''}${apagada ? ' apagada' : ''}`, title: titulo, 'aria-hidden': titulo ? null : 'true' }, nivel < 0 ? '' : String(nivel + 1));
}

/** As 6 primárias de um forno: P01 P02 P03 | P04 P05 P06. */
export function seis(calc, fornoId, mudou) {
  const f = fornoPorId[fornoId];
  return el('div', { class: 'seis', 'aria-label': `Primárias do ${fornoId}` }, f.prims.flatMap((pid, k) => {
    const p = primariaPorId[pid];
    const c = cel(calc.nivel[p.idx], { nova: mudou?.has(p.idx), titulo: `P0${p.p} · ${calc.nivel[p.idx] < 0 ? 'pendente' : ETAPAS[calc.nivel[p.idx]].curto}` });
    return k === 3 ? [el('span', { class: 'sep' }), c] : [c];
  }));
}

export function etiquetaEtapa(etapa) {
  return el('span', { class: `etiqueta-etapa cor-${etapa.id}` }, [el('span', { class: 'ponto' }), etapa.curto]);
}

export function legendaEtapas({ ativas = null, aoAlternar = null } = {}) {
  const itens = [
    el('span', {}, [el('span', { class: 'ponto vazio' }), 'Pendente']),
    ...ETAPAS.map((e, i) => {
      const conteudo = [el('span', { class: `ponto cor-${e.id}` }), `${i + 1} ${e.curto}`];
      if (!aoAlternar) return el('span', {}, conteudo);
      return el('button', { type: 'button', class: ativas && !ativas.has(e.id) ? 'apagada' : '', 'aria-pressed': String(!ativas || ativas.has(e.id)), onclick: () => aoAlternar(e.id) }, conteudo);
    })
  ];
  return el('div', { class: 'legenda' }, itens);
}

export const statusChip = (status, texto) => el('span', { class: `status-chip ${status}` }, texto);

/** Contador −/+ grande, para usar com luva. */
export function passoNumero({ valor, min = 0, max = 999, previsto = null, aoMudar, desativado = false }) {
  const saida = el('output', {}, String(valor));
  const caixa = el('div', { class: `passo-num${previsto != null && valor < previsto ? ' abaixo' : ''}` });
  const mudar = (d) => {
    valor = Math.max(min, Math.min(max, valor + d));
    saida.textContent = String(valor);
    caixa.classList.toggle('abaixo', previsto != null && valor < previsto);
    navigator.vibrate?.(6);
    aoMudar(valor);
  };
  caixa.append(
    el('button', { type: 'button', 'aria-label': 'Menos', disabled: desativado, onclick: () => mudar(-1) }, '−'),
    saida,
    el('button', { type: 'button', 'aria-label': 'Mais', disabled: desativado, onclick: () => mudar(1) }, '+')
  );
  return caixa;
}
