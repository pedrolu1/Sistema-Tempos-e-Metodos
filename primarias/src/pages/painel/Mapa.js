// Mapa visual: a bateria inteira, com filtro por etapa e as outras baterias.
import { el } from '../../../../src/utils/dom.js';
import { segmented } from '../../../../src/components/ui.js';
import { legendaEtapas } from '../../components/base.js';
import { mapaBateria } from '../../components/mapa.js';
import { abrirForno } from '../../components/detalheForno.js';
import { abrirChecklist } from '../../components/checklistFolha.js';
import { BATERIAS, CONTRATOS, ETAPAS, contratoAtivo } from '../../data/obra.js';
import { contagemPorEtapa, avancoFisico, idxsDaBateria } from '../../lib/calculo.js';
import { cancelarLancamento } from '../../lib/store.js';
import { toast } from '../../../../src/lib/toast.js';

let bateria = null;
let visiveis = null;

export function paginaMapa(ctx) {
  const { calc, perfil, leitura, mudou } = ctx;
  bateria ||= contratoAtivo().bateria;
  const contrato = CONTRATOS.find((c) => c.bateria === bateria);
  const cont = contagemPorEtapa(calc, bateria);
  const total = cont.reduce((s, n) => s + n, 0);
  const redesenhar = (ev) => ev.currentTarget.closest('.painel-pagina').replaceChildren(...paginaMapa(ctx));
  const abrir = (fid) => abrirForno(fid, {
    aoChecklist: (f) => abrirChecklist(f, { perfil, gestao: !leitura, leitura }),
    aoCancelar: leitura ? null : (l) => {
      const motivo = prompt('Motivo do cancelamento (fica registrado):');
      if (motivo == null) return;
      cancelarLancamento(l.id, perfil.nome, motivo);
      toast('Lançamento cancelado. O mapa já voltou.', 'ok');
    }
  });

  return [
    el('div', { class: 'entre', style: { flexWrap: 'wrap' } }, [
      segmented(BATERIAS.map((b) => ({ value: b, label: `Bateria ${b}` })), bateria, (v) => {
        bateria = v;
        document.querySelector('.painel-pagina').replaceChildren(...paginaMapa(ctx));
      }),
      el('span', { class: 'fraco', style: { fontSize: '13.5px' } }, `${contrato?.nome || ''}${contrato?.ativo ? ' · em andamento' : ' · encerrado'} · ${Math.round(avancoFisico(calc, idxsDaBateria(bateria)) * 100)}% físico`)
    ]),
    el('section', { class: 'cartao' }, [
      el('div', { class: 'cartao-topo' }, [
        el('div', {}, [el('h3', {}, `Bateria ${bateria}`), el('p', {}, 'Clique numa etapa da legenda para destacar só ela. Clique num forno para ver as datas e quem lançou.')]),
        visiveis ? el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: (ev) => { visiveis = null; redesenhar(ev); } }, 'Mostrar todas') : null
      ]),
      legendaEtapas({ ativas: visiveis, aoAlternar: (id) => {
        visiveis = visiveis ? new Set(visiveis) : new Set();
        if (visiveis.has(id)) visiveis.delete(id);
        else visiveis.add(id);
        if (!visiveis.size) visiveis = null;
        document.querySelector('.painel-pagina').replaceChildren(...paginaMapa(ctx));
      } }),
      mapaBateria(calc, bateria, { mudou, etapasVisiveis: visiveis, aoClicarForno: abrir, grande: true })
    ]),
    el('section', { class: 'cartao' }, [
      el('h3', {}, 'Resumo da bateria'),
      el('div', { class: 'table-wrap' }, el('table', { class: 'data-table tabela-compacta' }, [
        el('thead', {}, el('tr', {}, [el('th', {}, 'Situação (etapa mais avançada)'), el('th', { class: 'n' }, 'Primárias'), el('th', { class: 'n' }, '%')])),
        el('tbody', {}, [
          el('tr', {}, [el('td', {}, el('span', { class: 'linha' }, [el('span', { class: 'ponto', style: { background: 'var(--e-pendente)', outline: '1px solid var(--border)' } }), 'Pendente'])), el('td', { class: 'n' }, String(cont[0])), el('td', { class: 'n' }, `${Math.round((cont[0] / total) * 100)}%`)]),
          ...ETAPAS.map((e, i) => el('tr', {}, [el('td', {}, el('span', { class: `linha cor-${e.id}` }, [el('span', { class: 'ponto' }), e.nome])), el('td', { class: 'n' }, String(cont[i + 1])), el('td', { class: 'n' }, `${Math.round((cont[i + 1] / total) * 100)}%`)])),
          el('tr', {}, [el('td', { class: 'strong' }, 'Total'), el('td', { class: 'n strong' }, String(total)), el('td', { class: 'n' }, '100%')])
        ])
      ]))
    ])
  ];
}
