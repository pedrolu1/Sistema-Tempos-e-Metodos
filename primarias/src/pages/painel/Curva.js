// Curva S: contratual (fornos concluídos) e física (pelas 6 etapas), com a
// tabela semanal e o replanejado editável pelo planejador.
import { el } from '../../../../src/utils/dom.js';
import { graficoCurvaS, graficoSemanal } from '../../components/graficos.js';
import { contratoAtivo } from '../../data/obra.js';
import { curvaS } from '../../lib/calculo.js';
import { salvarConfig } from '../../lib/store.js';
import { curta, nomeBm } from '../../lib/datas.js';

const pct = (v) => (v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);

export function paginaCurva({ calc, leitura }) {
  const curva = curvaS(calc);
  const { escopo, pontos } = curva;
  const contrato = contratoAtivo();
  const replan = calc.estado.config.replanejado || {};
  const ult = [...pontos].reverse().find((p) => p.realizadoAcum != null);
  const prevHoje = ult ? ult.previstoAcum : 0;

  return [
    el('div', { class: 'indicadores' }, [
      bloco('Previsto até agora', `${prevHoje} fornos`, pct(prevHoje / escopo)),
      bloco('Realizado', `${ult?.realizadoAcum ?? 0} fornos`, pct((ult?.realizadoAcum ?? 0) / escopo)),
      bloco('Saldo', `${(ult?.realizadoAcum ?? 0) - prevHoje >= 0 ? '+' : ''}${(ult?.realizadoAcum ?? 0) - prevHoje} fornos`, (ult?.realizadoAcum ?? 0) >= prevHoje ? 'à frente do previsto' : 'atrás do previsto'),
      bloco('Avanço físico', pct(ult?.fisico ?? 0), 'pelas 6 etapas, com os pesos da configuração')
    ]),
    el('section', { class: 'cartao' }, [
      el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Curva S acumulada'), el('p', {}, `${contrato.nome} · bateria ${contrato.bateria} · ${escopo} fornos. Passe o mouse para ver cada semana.`)])]),
      graficoCurvaS(curva, { altura: 340 })
    ]),
    el('section', { class: 'cartao' }, [
      el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Fornos concluídos por semana'), el('p', {}, 'Um forno conta na semana em que a última primária recebeu a massa 1200.')])]),
      graficoSemanal(curva)
    ]),
    el('section', { class: 'cartao' }, [
      el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Semana a semana'), el('p', {}, leitura ? 'Previsto da planilha da Curva S.' : 'Previsto da planilha da Curva S. O replanejado você ajusta aqui e a curva redesenha na hora.')])]),
      el('div', { class: 'table-wrap' }, el('table', { class: 'data-table tabela-compacta' }, [
        el('thead', {}, el('tr', {}, ['Semana', 'Período', 'BM', 'Previsto', 'Replanejado', 'Realizado', 'Aderência', 'Previsto acum.', 'Realizado acum.', 'Físico'].map((t, i) => el('th', { class: i >= 3 ? 'n' : '' }, t)))),
        el('tbody', {}, pontos.map((p) => el('tr', { class: p.atual ? 'semana-atual' : '' }, [
          el('td', { class: 'strong' }, p.semana),
          el('td', {}, `${curta(p.inicio)} a ${curta(p.fim)}`),
          el('td', {}, nomeBm(p.bm)),
          el('td', { class: 'n' }, String(p.previsto)),
          el('td', { class: 'n' }, leitura ? (p.replanejado ?? '—') : el('input', {
            class: 'input input-compact', type: 'number', min: 0, max: 99, value: replan[p.semana] ?? '', placeholder: '—',
            style: { width: '74px', height: '34px', textAlign: 'right' }, 'aria-label': `Replanejado ${p.semana}`,
            onchange: (ev) => {
              const novo = { ...replan };
              if (ev.target.value === '') delete novo[p.semana];
              else novo[p.semana] = Math.max(0, Math.round(Number(ev.target.value)));
              salvarConfig({ replanejado: novo });
            }
          })),
          el('td', { class: 'n' }, p.realizado == null ? '—' : String(p.realizado)),
          el('td', { class: 'n' }, p.realizado == null || !(p.replanejado ?? p.previsto) ? '—' : pct(p.realizado / (p.replanejado ?? p.previsto))),
          el('td', { class: 'n' }, `${p.previstoAcum} · ${pct(p.previstoAcum / escopo)}`),
          el('td', { class: 'n' }, p.realizadoAcum == null ? '—' : `${p.realizadoAcum} · ${pct(p.realizadoAcum / escopo)}`),
          el('td', { class: 'n' }, pct(p.fisico))
        ])))
      ]))
    ])
  ];
}

function bloco(rotulo, valor, texto) {
  return el('div', { class: 'indicador' }, [el('span', {}, rotulo), el('div', { class: 'num', style: { fontSize: '30px' } }, valor), el('p', {}, texto)]);
}
