// Curva S de revestimento por BM: fornos com as 6 primárias na massa 1200,
// semana a semana contra a meta do BM (36 por padrão, dividida nas semanas).
// O planejador ajusta a meta de cada semana aqui; a do BM, em Configuração.
import { el } from '../../../../src/utils/dom.js';
import { graficoCurvaBm, graficoBms } from '../../components/graficos.js';
import { contratoAtivo } from '../../data/obra.js';
import { curvaBm, bmsDoContrato, bmAtual, metaDoBm } from '../../lib/calculo.js';
import { salvarConfig } from '../../lib/banco.js';
import { curta, nomeBm, rotuloBm } from '../../lib/datas.js';

let bmEscolhido = null;
const qtd = (n) => `${n} forno${n === 1 ? '' : 's'}`;
const pct = (v) => (v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`);

export function paginaCurva(ctx) {
  const { calc, leitura } = ctx;
  const atual = bmAtual();
  const bms = bmsDoContrato(calc).map((b) => ({ ...b, rotulo: rotuloBm(b.bm), atual: b.bm === atual }));
  if (!bmEscolhido || !bms.some((b) => b.bm === bmEscolhido)) bmEscolhido = atual;
  const c = curvaBm(calc, bmEscolhido);
  const ehAtual = bmEscolhido === atual;
  const ajustes = calc.estado.config?.metaSemanas || {};
  const contrato = contratoAtivo();
  const redesenhar = () => ctx.redesenhar();

  const seletor = el('div', { class: 'blocos-trilho', role: 'tablist', 'aria-label': 'Boletins de medição' }, bms.map((b) => el('button', {
    type: 'button', role: 'tab', 'aria-selected': String(b.bm === bmEscolhido), class: `bloco-op${b.bm === bmEscolhido ? ' ativo' : ''}`,
    onclick: (ev) => { bmEscolhido = b.bm; redesenhar(); }
  }, [`BM ${b.rotulo}`, el('i', {}, el('b', { style: { width: `${Math.min(100, (b.realizado / (b.meta || 1)) * 100)}%` } })), el('small', {}, `${b.realizado}/${b.meta}`)])));

  const semana = c.atual;
  return [
    seletor,
    el('div', { class: 'indicadores' }, [
      bloco(`Meta do BM ${rotuloBm(c.bm)}`, qtd(c.meta), `${nomeBm(c.bm)} · ${c.pontos.length} semanas`),
      bloco('Revestidos no BM', qtd(c.realizado), `${pct(c.realizado / c.meta)} da meta`, c.realizado >= c.meta ? 'bom' : ''),
      ehAtual
        ? bloco('Faltam', qtd(c.faltam), c.faltam ? `ritmo de ${c.ritmo} por semana até ${curta(c.fim)}` : 'meta do BM batida', c.faltam ? 'alerta' : 'bom')
        : bloco('Saldo', `${c.realizado - c.meta >= 0 ? '+' : ''}${c.realizado - c.meta} fornos`, c.realizado >= c.meta ? 'acima da meta' : 'abaixo da meta', c.realizado >= c.meta ? 'bom' : 'alerta'),
      ehAtual && semana
        ? bloco(`Semana ${semana.semana}`, `${semana.realizado} de ${semana.meta}`, `${curta(semana.ini)} a ${curta(semana.fim)}`, semana.realizado >= semana.meta ? 'bom' : '')
        : bloco('Aderência', pct(c.realizado / c.meta), 'revestidos ÷ meta do BM')
    ]),
    el('section', { class: 'cartao' }, [
      el('div', { class: 'cartao-topo' }, [el('div', {}, [
        el('h3', {}, `Curva S · BM ${rotuloBm(c.bm)}`),
        el('p', {}, `Revestimento da bateria ${contrato.bateria}, em fornos. Conta o forno na semana em que a última primária recebeu a massa 1200. Semana sem revestimento fica com zero.`)
      ])]),
      graficoCurvaBm(c, { altura: 340 })
    ]),
    el('section', { class: 'cartao' }, [
      el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Semana a semana'), el('p', {}, leitura ? 'Meta e realizado de cada semana do BM.' : `A meta do BM (${metaDoBm(calc)}) é dividida nas semanas. Ajuste a meta de uma semana aqui; deixe em branco para voltar à divisão automática.`)])]),
      el('div', { class: 'table-wrap' }, el('table', { class: 'data-table tabela-compacta' }, [
        el('thead', {}, el('tr', {}, ['Semana', 'Período', 'Meta', 'Revestidos', 'Aderência', 'Meta acum.', 'Realizado acum.', 'Fornos'].map((t, i) => el('th', { class: i >= 2 && i <= 6 ? 'n' : '' }, t)))),
        el('tbody', {}, c.pontos.map((p) => {
          const chave = `${c.bm}:${p.semana}`;
          return el('tr', { class: p.atual ? 'semana-atual' : '' }, [
            el('td', { class: 'strong' }, p.atual ? [p.semana, el('small', { class: 'fraco' }, ' atual')] : p.semana),
            el('td', {}, `${curta(p.ini)} a ${curta(p.fim)}`),
            el('td', { class: 'n' }, leitura ? String(p.meta) : el('input', {
              class: 'input input-compact', type: 'number', min: 0, max: 99, value: ajustes[chave] ?? '', placeholder: String(p.meta),
              style: { width: '70px', height: '34px', textAlign: 'right' }, 'aria-label': `Meta da ${p.semana}`,
              onchange: (ev) => {
                const novo = { ...ajustes };
                if (ev.target.value === '') delete novo[chave];
                else novo[chave] = Math.max(0, Math.round(Number(ev.target.value)));
                salvarConfig({ metaSemanas: novo });
              }
            })),
            el('td', { class: 'n' }, p.realizado == null ? '—' : String(p.realizado)),
            el('td', { class: 'n' }, p.realizado == null || !p.meta ? '—' : pct(p.realizado / p.meta)),
            el('td', { class: 'n' }, String(p.metaAcum)),
            el('td', { class: 'n' }, p.realizadoAcum == null ? '—' : String(p.realizadoAcum)),
            el('td', { class: 'fraco', style: { fontSize: '12.5px' } }, p.fornos.length ? p.fornos.map((f) => f.replace('-', ' ')).join(', ') : '—')
          ]);
        }))
      ]))
    ]),
    el('section', { class: 'cartao' }, [
      el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Fornos revestidos por BM'), el('p', {}, `${contrato.nome} · bateria ${contrato.bateria}`)])]),
      graficoBms(bms)
    ])
  ];
}

function bloco(rotulo, valor, texto, classe = '') {
  return el('div', { class: `indicador ${classe}` }, [el('span', {}, rotulo), el('div', { class: 'num', style: { fontSize: '30px' } }, valor), el('p', {}, texto)]);
}
