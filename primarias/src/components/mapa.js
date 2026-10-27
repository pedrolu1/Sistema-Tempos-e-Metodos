// Mapa visual da bateria, desenhado como ela é: duas metades de 4 blocos,
// com os lados coque virados para a via do carro de apagamento no meio.
import { el } from '../../../src/utils/dom.js';
import { cel } from './base.js';
import { ETAPAS, FORNOS, blocosDa, fornoPorId, primariaPorId, FORNOS_POR_BLOCO } from '../data/obra.js';

const ordemPrim = (lado, invertido) => {
  const lm = [1, 2, 3];
  const lc = [4, 5, 6];
  // metade de cima: LM em cima; metade de baixo (espelhada): LC em cima
  return invertido ? { cima: [...lc].reverse(), baixo: [...lm].reverse() } : { cima: lm, baixo: lc };
};

/**
 * Mapa horizontal da bateria inteira (painel).
 * `etapasVisiveis`: Set de etapas destacadas (as outras ficam apagadas).
 */
export function mapaBateria(calc, bateria, { aoClicarForno, etapasVisiveis = null, mudou = null, foco = null, grande = false } = {}) {
  const blocos = blocosDa(bateria);
  const metades = [blocos.slice(0, 4), blocos.slice(4)];
  const desenhaMetade = (lista, invertido) => {
    const ordem = ordemPrim(null, invertido);
    return el('div', { class: 'mapa-metade' }, [
      el('div', { class: 'mapa-lados', 'aria-hidden': 'true' }, (invertido ? ['LC', 'LM'] : ['LM', 'LC']).map((t) => el('span', {}, t))),
      ...lista.map((bl) => {
        const b = calc.blocos[bl];
        return el('div', { class: `mapa-bloco${b.concluidoEm ? ' fechado' : ''}` }, [
          el('div', { class: 'mapa-bloco-nome' }, [bl, el('small', {}, `${b.concluidos}/${FORNOS_POR_BLOCO}`)]),
          el('div', { class: 'mapa-fornos' }, Array.from({ length: FORNOS_POR_BLOCO }, (_, k) => colunaForno(calc, `${bl}-F${String(k + 1).padStart(2, '0')}`, ordem, { aoClicarForno, etapasVisiveis, mudou, foco })))
        ]);
      })
    ]);
  };
  const mapa = el('div', { class: 'mapa-bat' }, [
    desenhaMetade(metades[0], false),
    el('div', { class: 'mapa-via' }, 'Via do carro de apagamento · Torre de apagamento'),
    desenhaMetade(metades[1], true)
  ]);
  ajustarNaLargura(mapa, grande ? 16 : 13);
  return mapa;
}

/**
 * Tamanho do quadradinho para os 72 fornos de cada metade caberem na largura
 * do cartão. Abaixo de 6 px fica pequeno demais: aí o mapa rola de lado.
 */
function ajustarNaLargura(mapa, maximo) {
  const ro = new ResizeObserver((entradas) => {
    if (!mapa.isConnected) return ro.disconnect();
    const w = entradas[0].contentRect.width;
    if (!w) return;
    // por metade: rótulo dos lados (~28 px), 72 colunas (célula + 4 px) e 3 vãos de 14 px entre blocos
    const cel = Math.max(6, Math.min(maximo, Math.floor((w - 28 - 42 - 16) / 72) - 4));
    mapa.style.setProperty('--cel', `${cel}px`);
  });
  ro.observe(mapa);
}

function colunaForno(calc, fid, ordem, { aoClicarForno, etapasVisiveis, mudou, foco }) {
  const f = fornoPorId[fid];
  const fc = calc.fornos[fid];
  const celula = (p) => {
    const pr = primariaPorId[f.prims[p - 1]];
    const n = calc.nivel[pr.idx];
    const apagada = etapasVisiveis && (n < 0 || !etapasVisiveis.has(ETAPAS[n].id));
    return cel(n, { nova: mudou?.has(pr.idx), apagada });
  };
  const resumo = fc.concluidoEm ? 'concluído' : `${fc.niveis.filter((n) => n === ETAPAS.length - 1).length} de 6 primárias prontas`;
  return el('button', {
    type: 'button',
    class: `mf${fc.concluidoEm ? ' fechado' : ''}${foco === fid ? ' foco' : ''}`,
    title: `${fid.replace('-', ' · ')} · ${resumo}`,
    'aria-label': `${fid}, ${resumo}`,
    onclick: () => aoClicarForno?.(fid)
  }, [...ordem.cima.map(celula), el('span', { class: 'n' }, String(f.forno)), ...ordem.baixo.map(celula)]);
}

/** Mapa de um bloco no celular: 18 linhas, LM à esquerda e LC à direita, F18 em cima como na planilha. */
export function mapaBloco(calc, bloco, { aoClicarForno, mudou = null } = {}) {
  const fornos = FORNOS.filter((f) => f.bloco === bloco).sort((a, b) => b.forno - a.forno);
  return el('div', { class: 'mapa-m' }, [
    el('div', { class: 'mapa-m-cab' }, [el('span', {}, 'LM · P01 P02 P03'), el('span', {}, 'Forno'), el('span', {}, 'LC · P04 P05 P06')]),
    ...fornos.map((f) => {
      const fc = calc.fornos[f.id];
      const c = (k) => {
        const p = primariaPorId[f.prims[k]];
        return cel(calc.nivel[p.idx], { nova: mudou?.has(p.idx) });
      };
      return el('button', { type: 'button', class: `mapa-m-linha${fc.concluidoEm ? ' fechado' : ''}`, 'aria-label': `Forno ${f.forno}${fc.concluidoEm ? ', concluído' : ''}`, onclick: () => aoClicarForno?.(f.id) }, [
        el('div', { class: 'lado' }, [c(0), c(1), c(2)]),
        el('span', { class: 'fno' }, `F${String(f.forno).padStart(2, '0')}`),
        el('div', { class: 'lado' }, [c(3), c(4), c(5)])
      ]);
    })
  ]);
}
