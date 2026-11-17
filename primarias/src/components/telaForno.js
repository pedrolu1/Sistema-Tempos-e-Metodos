// Tela do forno para o líder: toca no forno, vê os dois lados, lança a
// próxima etapa de cada lado com um toque e, no fim, tira as fotos do
// checklist. Tudo em tempo real e funcionando sem internet.
import { el } from '../../../src/utils/dom.js';
import { abrirFolha, cel, statusChip } from './base.js';
import { ic, iconeEtapa } from '../lib/icones.js';
import { ETAPAS, ETAPAS_MAPA, LADOS, SLOTS_FOTO, fornoPorId, primariaPorId, noMeio, rotulo } from '../data/obra.js';
import { calcular, checklists, proximaDoLado, idxsDoForno } from '../lib/calculo.js';
import { assinar } from '../lib/banco.js';
import { curta, completa } from '../lib/datas.js';
import { abrirLancamento } from './lancar.js';
import { abrirChecklistFotos, NOME_STATUS } from './checklistFotos.js';

export function abrirTelaForno(fid, { perfil, leitura = false }) {
  const f = fornoPorId[fid];
  const folha = abrirFolha({ titulo: rotulo(fid), corpo: [], classe: 'folha-forno', aoFechar: () => parar() });
  const parar = assinar((estado) => desenhar(calcular(estado)));

  function desenhar(calc) {
    const fc = calc.fornos[fid];
    const ck = checklists(calc)[fid];
    const nFotos = ck ? SLOTS_FOTO.filter((s) => ck.fotos?.[s.id]).length : 0;
    const idxs = idxsDoForno(fid);

    const lado = (l) => {
      const prims = f.prims.filter((id) => primariaPorId[id].lado === l.id);
      const prox = leitura ? null : proximaDoLado(calc, fid, l.id);
      const andaime = fc.andaime[l.id];
      return el('section', { class: 'lado-forno' }, [
        el('div', { class: 'entre' }, [
          el('strong', { class: 'lado-nome' }, [l.nome, el('small', {}, l.id === 'LM' ? 'P01 a P03' : 'P04 a P06')]),
          el('span', { class: `andaime-chip ${andaime || 'sem'}` }, [el('span', { html: andaime === 'desmontado' ? ic.desmontagem(14) : ic.andaime(14) }), andaime === 'montado' ? 'Andaime montado' : andaime === 'desmontado' ? 'Andaime desmontado' : 'Sem andaime'])
        ]),
        el('div', { class: 'prims-lado' }, prims.map((id) => {
          const p = primariaPorId[id];
          const n = calc.nivel[p.idx];
          return el('div', { class: 'prim-estado' }, [
            cel(n, { titulo: n < 0 ? 'pendente' : ETAPAS_MAPA[n].curto }),
            el('div', {}, [el('strong', {}, `P0${p.p}`), el('small', {}, n < 0 ? 'Pendente' : ETAPAS_MAPA[n].curto)])
          ]);
        })),
        prox
          ? el('button', {
              type: 'button', class: `btn btn-etapa cor-${prox.etapa.id}`,
              onclick: () => abrirLancamento({ perfil, etapa: prox.etapa.id, fornoId: fid, alvos: prox.alvos })
            }, [el('span', { html: iconeEtapa(prox.etapa.id, 20) }), `Lançar ${noMeio(prox.etapa)}`])
          : leitura ? null : el('div', { class: 'lado-pronto' }, [el('span', { html: ic.check(16) }), 'Tudo lançado neste lado'])
      ]);
    };

    const linhaDoTempo = el('div', { class: 'linha-tempo compacta' }, ETAPAS.map((e, k) => {
      const datas = idxs.map((i) => calc.feitas[i][k]).filter(Boolean).sort();
      const total = 6;
      const classe = datas.length === total ? 'feita' : datas.length ? 'parcial' : '';
      return el('div', { class: `lt-item cor-${e.id} ${classe}` }, [
        el('span', { class: 'lt-marca', html: datas.length === total ? ic.check(15) : iconeEtapa(e.id, 14) }),
        el('div', {}, [el('strong', {}, e.nome), el('span', {}, datas.length === total ? 'Concluída' : datas.length ? `${datas.length} de 6 primárias` : 'Ainda não')]),
        el('span', { class: 'data' }, datas.length ? (datas[0] === datas[datas.length - 1] ? curta(datas[0]) : `${curta(datas[0])} a ${curta(datas[datas.length - 1])}`) : '')
      ]);
    }));

    const cartaoFotos = el('button', {
      type: 'button', class: `cartao-fotos${nFotos === SLOTS_FOTO.length ? ' completo' : ''}`,
      onclick: () => abrirChecklistFotos(fid, { perfil, modo: leitura ? 'leitura' : 'campo' })
    }, [
      el('span', { class: 'cartao-fotos-icone', html: ic.camera(26) }),
      el('div', {}, [
        el('strong', {}, 'Fotos do checklist'),
        el('small', {}, ck?.origem === 'planilha' ? 'Aprovado antes do app' : `${nFotos} de 8 fotos · ${NOME_STATUS[ck?.status || 'pendente']}`),
        el('div', { class: 'check-barra' }, el('i', { style: { width: `${(nFotos / SLOTS_FOTO.length) * 100}%` } }))
      ]),
      ck?.numero ? statusChip('aprovado', `Nº ${ck.numero}`) : el('span', { html: ic.chevronLeft(18), style: { transform: 'scaleX(-1)', display: 'inline-flex' } })
    ]);

    folha.montar({
      titulo: rotulo(fid),
      subtitulo: fc.concluidoEm ? `Concluído em ${completa(fc.concluidoEm)}` : `${fc.niveis.filter((n) => n === ETAPAS_MAPA.length - 1).length} de 6 primárias com massa 1200`,
      corpo: [
        el('div', { class: 'lados-forno' }, LADOS.map(lado)),
        cartaoFotos,
        el('details', { class: 'mais-detalhes' }, [el('summary', {}, 'Etapas do forno'), linhaDoTempo])
      ]
    });
  }
  return folha;
}
