// Detalhe de um forno: as 6 etapas em linha do tempo, quem lançou e o
// atalho para a próxima etapa (campo) ou para cancelar um lançamento (painel).
import { el } from '../../../src/utils/dom.js';
import { abrirFolha, seis, statusChip } from './base.js';
import { ic, iconeEtapa } from '../lib/icones.js';
import { ETAPAS, fornoPorId, primariaPorId, noMeio } from '../data/obra.js';
import { calcular, checklists, idxsDoForno, avancoFisico, situacaoAlvo } from '../lib/calculo.js';
import { assinar } from '../lib/store.js';
import { completa, curta, haQuanto } from '../lib/datas.js';

export function abrirForno(fid, { aoLancar = null, aoCancelar = null, aoChecklist = null } = {}) {
  const f = fornoPorId[fid];
  const folha = abrirFolha({ titulo: fid.replace('-', ' · '), corpo: [], aoFechar: () => parar() });
  const parar = assinar((estado) => desenhar(calcular(estado)));

  function desenhar(calc) {
    const fc = calc.fornos[fid];
    const idxs = idxsDoForno(fid);
    const av = avancoFisico(calc, idxs);
    const ck = checklists(calc)[fid];
    const proxima = ETAPAS.find((e) => f.prims.some((pid) => situacaoAlvo(calc, e.id, pid).ok));
    const lancs = calc.validos.filter((l) => l.prims.some((pid) => primariaPorId[pid].fornoId === fid)).reverse();
    folha.montar({
      titulo: fid.replace('-', ' · '),
      subtitulo: fc.concluidoEm ? `Concluído em ${completa(fc.concluidoEm)}` : `${Math.round(av * 100)}% do avanço físico do forno`,
      corpo: [
        el('div', { class: 'entre' }, [seis(calc, fid), ck ? statusChip(ck.status, ck.status === 'aprovado' ? `Checklist nº ${ck.numero}` : ck.status === 'enviado' ? 'Checklist enviado' : 'Checklist pendente') : null]),
        el('div', { class: 'linha-tempo' }, ETAPAS.map((e, k) => {
          const datas = idxs.map((i) => calc.feitas[i][k]).filter(Boolean).sort();
          const feitas = datas.length;
          const classe = feitas === 6 ? 'feita' : feitas ? 'parcial' : '';
          return el('div', { class: `lt-item cor-${e.id} ${classe}` }, [
            el('span', { class: 'lt-marca', html: feitas === 6 ? ic.check(16) : iconeEtapa(e.id, 15) }),
            el('div', {}, [el('strong', {}, e.nome), el('span', {}, feitas === 6 ? 'As 6 primárias' : feitas ? `${feitas} de 6 primárias` : 'Ainda não')]),
            el('span', { class: 'data' }, feitas ? (datas[0] === datas[datas.length - 1] ? curta(datas[0]) : `${curta(datas[0])} a ${curta(datas[datas.length - 1])}`) : '')
          ]);
        })),
        lancs.length
          ? el('div', { class: 'pilha' }, [
              el('div', { class: 'titulo-secao' }, ['Lançamentos', el('small', {}, `${lancs.length}`)]),
              el('div', { class: 'feed' }, lancs.slice(0, 12).map((l) => {
                const e = ETAPAS.find((x) => x.id === l.etapa);
                return el('div', { class: `feed-item cor-${e.id}` }, [
                  el('span', { class: 'feed-icone', html: iconeEtapa(e.id, 18) }),
                  el('div', { class: 'feed-texto' }, [el('strong', {}, `${e.curto} · ${l.prims.filter((p) => primariaPorId[p].fornoId === fid).length} primária(s)`), el('span', {}, `${l.autor?.nome || ''} · dia ${curta(l.data)}${l.obs ? ` · ${l.obs}` : ''}`)]),
                  aoCancelar ? el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => aoCancelar(l) }, 'Cancelar') : el('span', { class: 'feed-quando' }, haQuanto(l.criadoEm))
                ]);
              }))
            ])
          : el('p', { class: 'fraco', style: { fontSize: '13.5px' } }, fc.concluidoEm || fc.minimo >= 0 ? 'Etapas vindas da planilha de controle (antes do app).' : 'Nenhuma etapa lançada neste forno ainda.')
      ],
      pe: [
        aoChecklist && fc.concluidoEm ? el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { folha.fechar(); aoChecklist(fid); } }, [el('span', { html: ic.prancheta(18) }), 'Checklist']) : null,
        aoLancar && proxima ? el('button', { class: `btn btn-brasa`, style: { flex: 1 }, type: 'button', onclick: () => { folha.fechar(); aoLancar(proxima.id, fid); } }, [el('span', { html: iconeEtapa(proxima.id, 20) }), `Lançar ${noMeio(proxima)}`]) : null
      ].filter(Boolean)
    });
  }
  return folha;
}
