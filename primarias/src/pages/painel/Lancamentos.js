// Todos os lançamentos do app, com filtro por etapa e por pessoa. O
// planejador cancela ou troca o dia; o gestor só consulta.
import { el } from '../../../../src/utils/dom.js';
import { etiquetaEtapa } from '../../components/base.js';
import { ETAPAS, etapaPorId } from '../../data/obra.js';
import { resumoAlvos } from '../../lib/calculo.js';
import { cancelarLancamento, trocarDataLancamento } from '../../lib/store.js';
import { completa, haQuanto, hoje } from '../../lib/datas.js';
import { toast } from '../../../../src/lib/toast.js';

const filtro = { etapa: '', pessoa: '', canceladas: false };

export function paginaLancamentos(ctx) {
  const { calc, perfil, leitura } = ctx;
  const todos = [...calc.estado.lancamentos].sort((a, b) => b.criadoEm - a.criadoEm);
  const pessoas = [...new Map(todos.map((l) => [l.autor?.uid, l.autor?.nome])).entries()];
  const lista = todos.filter((l) => (!filtro.etapa || l.etapa === filtro.etapa) && (!filtro.pessoa || l.autor?.uid === filtro.pessoa) && (filtro.canceladas || l.status === 'valido'));
  const redesenhar = () => document.querySelector('.painel-pagina').replaceChildren(...paginaLancamentos(ctx));
  const select = (valor, opcoes, aoMudar, rotulo) => el('select', { class: 'select', 'aria-label': rotulo, style: { width: 'auto', minWidth: '180px', height: '40px' }, onchange: (ev) => aoMudar(ev.target.value) }, opcoes.map(([v, t]) => el('option', { value: v, selected: v === valor }, t)));

  return [
    el('div', { class: 'toolbar' }, [
      select(filtro.etapa, [['', 'Todas as etapas'], ...ETAPAS.map((e) => [e.id, e.curto])], (v) => { filtro.etapa = v; redesenhar(); }, 'Etapa'),
      select(filtro.pessoa, [['', 'Todas as pessoas'], ...pessoas], (v) => { filtro.pessoa = v; redesenhar(); }, 'Pessoa'),
      el('label', { class: 'linha', style: { fontSize: '14px', color: 'var(--text-1)', cursor: 'pointer' } }, [el('input', { type: 'checkbox', checked: filtro.canceladas, onchange: (ev) => { filtro.canceladas = ev.target.checked; redesenhar(); } }), 'Mostrar cancelados']),
      el('span', { class: 'fraco', style: { marginLeft: 'auto', fontSize: '13.5px' } }, `${lista.length} lançamento${lista.length === 1 ? '' : 's'} · ${lista.reduce((s, l) => s + l.prims.length, 0)} etapas de primária`)
    ]),
    lista.length
      ? el('div', { class: 'table-wrap' }, el('table', { class: 'data-table tabela-compacta' }, [
          el('thead', {}, el('tr', {}, ['Etapa', 'Onde', 'Primárias', 'Dia do serviço', 'Quem', 'Lançado', leitura ? '' : 'Ações'].map((t, i) => el('th', { class: i === 2 ? 'n' : '' }, t)))),
          el('tbody', {}, lista.slice(0, 200).map((l) => el('tr', { style: l.status === 'cancelado' ? { opacity: '0.45' } : null }, [
            el('td', {}, etiquetaEtapa(etapaPorId[l.etapa])),
            el('td', { style: { maxWidth: '320px' } }, resumoAlvos(l.prims, l.etapa).join(', ')),
            el('td', { class: 'n strong' }, String(l.prims.length)),
            el('td', {}, completa(l.data)),
            el('td', {}, l.autor?.nome || ''),
            el('td', {}, l.status === 'cancelado' ? `cancelado por ${l.canceladoPor}` : haQuanto(l.criadoEm)),
            leitura || l.status !== 'valido'
              ? el('td', {})
              : el('td', {}, el('div', { class: 'acoes-linha' }, [
                  el('input', { class: 'input', type: 'date', value: l.data, max: hoje(), 'aria-label': 'Trocar o dia', style: { width: '150px', height: '34px' }, onchange: (ev) => { if (ev.target.value) { trocarDataLancamento(l.id, ev.target.value, perfil.nome); toast('Dia do lançamento trocado.', 'ok'); } } }),
                  el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: () => {
                    const motivo = prompt('Motivo do cancelamento (fica registrado):');
                    if (motivo == null) return;
                    cancelarLancamento(l.id, perfil.nome, motivo);
                    toast('Lançamento cancelado.', 'ok');
                  } }, 'Cancelar')
                ]))
          ])))
        ]))
      : el('div', { class: 'cartao' }, el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Nenhum lançamento no app ainda'), 'O histórico das planilhas já está no mapa e nas curvas. Os lançamentos novos do campo aparecem aqui.']))
  ];
}
