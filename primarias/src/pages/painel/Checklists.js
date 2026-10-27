// Checklists de entrega: a fila de aprovação e a relação dos fornos por
// boletim de medição, no formato do resumo enviado à Ternium.
import { el } from '../../../../src/utils/dom.js';
import { statusChip } from '../../components/base.js';
import { abrirChecklist } from '../../components/checklistFolha.js';
import { checklists, fornosPorBm } from '../../lib/calculo.js';
import { completa, nomeBm } from '../../lib/datas.js';
import { fornoPorId } from '../../data/obra.js';

const NOME = { pendente: 'Pendente', rascunho: 'Em preenchimento', enviado: 'Enviado', aprovado: 'Aprovado' };

export function paginaChecklists({ calc, perfil, leitura }) {
  const mapa = checklists(calc);
  const lista = Object.entries(mapa).map(([fid, c]) => ({ fid, ...c, concluidoEm: calc.fornos[fid].concluidoEm }));
  const enviados = lista.filter((c) => c.status === 'enviado');
  const noCampo = lista.filter((c) => ['pendente', 'rascunho'].includes(c.status));
  const abrir = (fid) => abrirChecklist(fid, { perfil, gestao: !leitura, leitura });
  const bms = Object.entries(fornosPorBm(calc)).sort((a, b) => b[0].localeCompare(a[0]));
  const local = (fid) => {
    const f = fornoPorId[fid];
    return `${f.bloco} - ${f.forno} - LC/LM`;
  };

  return [
    el('div', { class: 'painel-grade' }, [
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Esperando aprovação'), el('p', {}, leitura ? 'Checklists enviados pelo campo.' : 'Confira e aprove: o número sai na sequência da medição.')])]),
        enviados.length
          ? el('div', { class: 'pilha', style: { gap: '8px' } }, enviados.map((c) => el('div', { class: 'pedido' }, [
              el('div', {}, [el('strong', {}, c.fid.replace('-', ' · ')), el('p', {}, `Enviado por ${c.enviadoPor || 'campo'} · forno concluído em ${completa(c.concluidoEm)}`)]),
              el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => abrir(c.fid) }, leitura ? 'Ver' : 'Conferir')
            ])))
          : el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Nada na fila'), 'Quando o campo enviar um checklist, ele aparece aqui.'])
      ]),
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Ainda no campo'), el('p', {}, 'Fornos concluídos sem checklist enviado.')])]),
        noCampo.length
          ? el('div', { class: 'pilha', style: { gap: '8px' } }, noCampo.map((c) => el('div', { class: 'pedido' }, [
              el('div', {}, [el('strong', {}, c.fid.replace('-', ' · ')), el('p', {}, `${c.itens.filter(Boolean).length} de ${c.itens.length} itens marcados`)]),
              statusChip(c.status, NOME[c.status])
            ])))
          : el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Tudo em dia'), 'Nenhum forno concluído esperando checklist.'])
      ])
    ]),
    ...bms.map(([bm, fornos]) => el('section', { class: 'cartao' }, [
      el('div', { class: 'cartao-topo' }, [
        el('div', {}, [el('h3', {}, `Medição ${nomeBm(bm)}`), el('p', {}, 'Relação dos fornos reparados no período (pela data em que o forno fechou)')]),
        el('span', { class: 'num', style: { fontSize: '26px' } }, `${fornos.length} fornos`)
      ]),
      el('div', { class: 'table-wrap' }, el('table', { class: 'data-table tabela-compacta' }, [
        el('thead', {}, el('tr', {}, ['Item', 'Nº do checklist', 'Localização', 'Forno concluído em', 'Status do checklist', ''].map((t, i) => el('th', { class: i < 2 ? 'n' : '' }, t)))),
        el('tbody', {}, fornos.map((f, i) => {
          const c = mapa[f.id];
          return el('tr', {}, [
            el('td', { class: 'n' }, String(i + 1)),
            el('td', { class: 'n strong' }, c?.numero ? String(c.numero) : '—'),
            el('td', {}, local(f.id)),
            el('td', {}, completa(f.concluidoEm)),
            el('td', {}, statusChip(c.status, NOME[c.status])),
            el('td', {}, el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => abrir(f.id) }, 'Abrir'))
          ]);
        }))
      ]))
    ]))
  ];
}
