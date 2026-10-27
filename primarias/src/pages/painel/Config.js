// Configuração: pesos das etapas (avanço físico), itens do checklist e os
// cadastros que vieram das planilhas.
import { el } from '../../../../src/utils/dom.js';
import { ETAPAS, MATERIAIS, EFETIVO_MODELO, CONTRATOS, NIVEL_NOME, CHECKLIST_MODELO } from '../../data/obra.js';
import { pesosNormalizados } from '../../lib/calculo.js';
import { salvarConfig } from '../../lib/store.js';
import { toast } from '../../../../src/lib/toast.js';

export function paginaConfig({ calc, leitura }) {
  const cfg = calc.estado.config;
  const norm = pesosNormalizados(cfg);
  const podeEditar = !leitura;
  return [
    el('div', { class: 'painel-grade' }, [
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Peso de cada etapa'), el('p', {}, 'Define o avanço físico: quanto cada etapa vale do serviço de uma primária. Pode usar horas, custo ou percentual; o app converte.')])]),
        cfg.pesosProvisorios ? el('div', { class: 'bloqueado-nota' }, ['Pesos iguais por enquanto. Troque pelos oficiais do contrato.']) : null,
        el('div', { class: 'pesos' }, ETAPAS.map((e, i) => el('div', { class: `peso-linha cor-${e.id}` }, [
          el('span', { class: 'ponto', style: { width: '14px', height: '14px' } }),
          el('span', {}, [e.nome, el('small', { class: 'fraco', style: { display: 'block', fontSize: '12px' } }, NIVEL_NOME[e.nivel])]),
          el('input', { class: 'input', type: 'number', min: 0, step: 'any', value: cfg.pesos[e.id], disabled: !podeEditar, 'aria-label': `Peso ${e.curto}`, onchange: (ev) => {
            salvarConfig({ pesos: { ...cfg.pesos, [e.id]: Math.max(0, Number(ev.target.value) || 0) }, pesosProvisorios: false });
            toast('Peso salvo. A curva física já foi recalculada.', 'ok');
          } }),
          el('output', {}, `${(norm[i] * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
        ])))
      ]),
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Itens do checklist de entrega'), el('p', {}, 'Um item por linha. Modelo provisório: troque pelos itens oficiais.')])]),
        el('textarea', { class: 'textarea', rows: 11, disabled: !podeEditar, value: cfg.checklist.join('\n'), onchange: (ev) => {
          const itens = ev.target.value.split('\n').map((t) => t.trim()).filter(Boolean);
          salvarConfig({ checklist: itens.length ? itens : CHECKLIST_MODELO });
          toast('Itens do checklist salvos.', 'ok');
        } })
      ])
    ]),
    el('div', { class: 'painel-grade' }, [
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Materiais por primária'), el('p', {}, 'Da memória de cálculo do RDO. O consumo entra no dia em que a etapa é lançada.')])]),
        el('div', { class: 'table-wrap' }, el('table', { class: 'data-table tabela-compacta' }, [
          el('thead', {}, el('tr', {}, ['Material', 'Un.', 'Por primária', 'Etapa'].map((t, i) => el('th', { class: i === 2 ? 'n' : '' }, t)))),
          el('tbody', {}, MATERIAIS.map((m) => el('tr', {}, [el('td', {}, m.nome), el('td', {}, m.unidade), el('td', { class: 'n' }, String(m.porPrimaria)), el('td', {}, [ETAPAS.find((e) => e.id === m.etapa).curto, m.aConfirmar ? el('span', { class: 'status-chip pendente', style: { marginLeft: '8px' } }, 'a confirmar') : null])])))
        ]))
      ]),
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Efetivo previsto e contratos'), el('p', {}, 'Do modelo de RDO e das planilhas de controle.')])]),
        el('div', { class: 'table-wrap' }, el('table', { class: 'data-table tabela-compacta' }, [
          el('thead', {}, el('tr', {}, [el('th', {}, 'Função'), el('th', { class: 'n' }, 'Previsto (diurno)')])),
          el('tbody', {}, [...EFETIVO_MODELO.mod, ...EFETIVO_MODELO.moi, ...EFETIVO_MODELO.equipamentos].map(([f, n]) => el('tr', {}, [el('td', {}, f), el('td', { class: 'n' }, String(n))])))
        ])),
        el('div', { class: 'pilha', style: { gap: '6px', fontSize: '14px' } }, CONTRATOS.map((c) => el('div', { class: 'entre' }, [el('span', {}, `${c.nome} · bateria ${c.bateria}`), el('span', { class: `status-chip ${c.ativo ? 'enviado' : 'aprovado'}` }, c.ativo ? 'em andamento' : 'encerrado')])))
      ])
    ])
  ];
}
