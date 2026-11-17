// Checklists de entrega com fotos: a fila de aprovação, o que está no campo e
// a relação dos fornos por boletim de medição, no formato do resumo da Ternium.
import { el } from '../../../../src/utils/dom.js';
import { statusChip } from '../../components/base.js';
import { abrirChecklistFotos, NOME_STATUS } from '../../components/checklistFotos.js';
import { checklists, fornosPorBm } from '../../lib/calculo.js';
import { completa, nomeBm, rotuloBm, haQuanto } from '../../lib/datas.js';
import { localMedicao, rotulo } from '../../data/obra.js';
import { ic } from '../../lib/icones.js';

export function paginaChecklists({ calc, perfil, leitura }) {
  const mapa = checklists(calc);
  const lista = Object.entries(mapa).map(([fid, c]) => ({ fid, ...c }));
  const porData = (a, b) => (a.concluidoEm || '9').localeCompare(b.concluidoEm || '9') || a.fid.localeCompare(b.fid);
  const enviados = lista.filter((c) => c.status === 'enviado').sort(porData);
  const devolvidos = lista.filter((c) => c.status === 'devolvido').sort(porData);
  const noCampo = lista.filter((c) => c.concluidoEm && ['pendente', 'rascunho'].includes(c.status)).sort(porData);
  const abrir = (fid) => abrirChecklistFotos(fid, { perfil, modo: leitura ? 'leitura' : 'gestao' });
  const bms = Object.entries(fornosPorBm(calc)).sort((a, b) => b[0].localeCompare(a[0]));

  const linhaFila = (c, botao) => el('div', { class: 'pedido' }, [
    el('div', {}, [
      el('strong', {}, rotulo(c.fid)),
      el('p', {}, c.status === 'enviado'
        ? `Enviado por ${c.enviadoPor?.nome || c.enviadoPor || 'campo'}${c.enviadoEmLocal ? ` ${haQuanto(c.enviadoEmLocal)}` : ''} · forno concluído em ${completa(c.concluidoEm)}`
        : c.status === 'devolvido'
          ? `Devolvido${c.motivoDevolucao ? `: ${c.motivoDevolucao}` : ''}`
          : `${c.nFotos} de 8 fotos · concluído em ${completa(c.concluidoEm)}`)
    ]),
    botao
  ]);

  return [
    el('div', { class: 'painel-grade' }, [
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Esperando aprovação'), el('p', {}, leitura ? 'Checklists enviados pelo campo.' : 'Confira as 8 fotos e aprove: o número sai na sequência da medição.')])]),
        enviados.length
          ? el('div', { class: 'pilha', style: { gap: '8px' } }, enviados.map((c) => linhaFila(c, el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => abrir(c.fid) }, [el('span', { html: ic.camera(15) }), leitura ? 'Ver fotos' : 'Conferir']))))
          : el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Nada na fila'), 'Quando o líder enviar as fotos de um forno, ele aparece aqui.'])
      ]),
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Ainda no campo'), el('p', {}, 'Fornos concluídos sem as fotos enviadas, e os devolvidos para ajuste.')])]),
        devolvidos.length || noCampo.length
          ? el('div', { class: 'pilha', style: { gap: '8px' } }, [
              ...devolvidos.map((c) => linhaFila(c, statusChip('devolvido', 'Devolvido'))),
              ...noCampo.map((c) => linhaFila(c, el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => abrir(c.fid) }, `${c.nFotos}/8`)))
            ])
          : el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Tudo em dia'), 'Nenhum forno concluído esperando fotos.'])
      ])
    ]),
    ...bms.map(([bm, fornos]) => el('section', { class: 'cartao' }, [
      el('div', { class: 'cartao-topo' }, [
        el('div', {}, [el('h3', {}, `Medição BM ${rotuloBm(bm)} · ${nomeBm(bm)}`), el('p', {}, 'Relação dos fornos reparados no período (pela semana em que o forno fechou)')]),
        el('span', { class: 'num', style: { fontSize: '26px' } }, `${fornos.length} fornos`)
      ]),
      el('div', { class: 'table-wrap' }, el('table', { class: 'data-table tabela-compacta' }, [
        el('thead', {}, el('tr', {}, ['Item', 'Nº do checklist', 'Localização', 'Forno concluído em', 'Status do checklist', ''].map((t, i) => el('th', { class: i < 2 ? 'n' : '' }, t)))),
        el('tbody', {}, fornos.map((f, i) => {
          const c = mapa[f.id] || { status: 'pendente' };
          return el('tr', {}, [
            el('td', { class: 'n' }, String(i + 1)),
            el('td', { class: 'n strong' }, c.numero ? String(c.numero) : '—'),
            el('td', {}, localMedicao(f.id)),
            el('td', {}, completa(f.concluidoEm)),
            el('td', {}, statusChip(c.status, c.origem === 'planilha' ? 'Aprovado (planilha)' : NOME_STATUS[c.status])),
            el('td', {}, el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => abrir(f.id) }, 'Fotos'))
          ]);
        }))
      ]))
    ]))
  ];
}
