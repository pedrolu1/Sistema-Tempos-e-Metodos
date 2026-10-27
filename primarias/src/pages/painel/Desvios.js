// Desvios: por que a produção ficou abaixo do previsto, por dia, com os
// motivos e a empresa responsável (os mesmos da planilha de resumo).
import { el } from '../../../../src/utils/dom.js';
import { MOTIVOS_DESVIO, EMPRESAS_DESVIO, contratoAtivo } from '../../data/obra.js';
import { primariasDoDia } from '../../lib/calculo.js';
import { salvarDesvio } from '../../lib/store.js';
import { hoje, somarDias, completa, curta, nomeDia, semana, diaUtil } from '../../lib/datas.js';

let dias = 30;

export function paginaDesvios(ctx) {
  const { calc, leitura } = ctx;
  const desvios = calc.estado.desvios;
  const inicio = contratoAtivo().inicio;
  const lista = [];
  for (let d = hoje(), n = 0; d >= inicio && n < dias; d = somarDias(d, -1)) {
    if (!diaUtil(d) && !desvios[d]) continue;
    lista.push(d);
    n++;
  }
  const contar = (campo) => {
    const c = {};
    Object.entries(desvios).forEach(([d, v]) => d >= inicio && v[campo] && (c[v[campo]] = (c[v[campo]] || 0) + 1));
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  };
  const motivos = contar('motivo');
  const empresas = contar('empresa');
  const redesenhar = () => document.querySelector('.painel-pagina').replaceChildren(...paginaDesvios(ctx));

  return [
    el('div', { class: 'painel-grade' }, [
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Motivos mais frequentes'), el('p', {}, `Dias com desvio desde o início do contrato (${completa(inicio)})`)])]),
        barras(motivos)
      ]),
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Por empresa responsável'), el('p', {}, 'Quem originou o desvio')])]),
        barras(empresas)
      ])
    ]),
    el('section', { class: 'cartao' }, [
      el('div', { class: 'cartao-topo' }, [
        el('div', {}, [el('h3', {}, 'Dia a dia'), el('p', {}, leitura ? 'Produção do dia e o desvio registrado.' : 'Produção do dia sai dos lançamentos; registre o desvio quando o dia ficou abaixo do previsto.')]),
        el('div', { class: 'toolbar' }, [30, 60, 120].map((n) => el('button', { class: `btn btn-sm ${dias === n ? 'btn-primary' : 'btn-ghost'}`, type: 'button', onclick: () => { dias = n; redesenhar(); } }, `${n} dias`)))
      ]),
      el('div', { class: 'table-wrap' }, el('table', { class: 'data-table tabela-compacta' }, [
        el('thead', {}, el('tr', {}, ['Data', 'Semana', 'Demolição', 'Assentamento', 'Massa 1200', 'Empresa', 'Motivo', 'Observação'].map((t, i) => el('th', { class: i >= 2 && i <= 4 ? 'n' : '' }, t)))),
        el('tbody', {}, lista.map((d) => {
          const v = desvios[d] || {};
          const salvar = (mud) => {
            const novo = { ...v, ...mud, origem: 'app' };
            salvarDesvio(d, novo.empresa || novo.motivo || novo.obs ? novo : null);
          };
          const sel = (valor, opcoes, campo) => (leitura
            ? valor || '—'
            : el('select', { class: 'select', style: { height: '34px', minWidth: '150px', fontSize: '13.5px' }, onchange: (ev) => salvar({ [campo]: ev.target.value }) }, [el('option', { value: '' }, '—'), ...opcoes.map((o) => el('option', { value: o, selected: o === valor }, o)), valor && !opcoes.includes(valor) ? el('option', { value: valor, selected: true }, valor) : null]));
          return el('tr', {}, [
            el('td', { class: 'strong', style: { whiteSpace: 'nowrap' } }, `${curta(d)} ${nomeDia(d).slice(0, 3)}`),
            el('td', {}, semana(d)),
            el('td', { class: 'n' }, String(primariasDoDia(calc, d, 'demolicao').length)),
            el('td', { class: 'n' }, String(primariasDoDia(calc, d, 'assentamento').length)),
            el('td', { class: 'n strong' }, String(primariasDoDia(calc, d, 'massa1200').length)),
            el('td', {}, sel(v.empresa, EMPRESAS_DESVIO, 'empresa')),
            el('td', {}, sel(v.motivo, MOTIVOS_DESVIO, 'motivo')),
            el('td', {}, leitura ? v.obs || '' : el('input', { class: 'input', style: { height: '34px', minWidth: '180px', fontSize: '13.5px' }, value: v.obs || '', onchange: (ev) => salvar({ obs: ev.target.value }) }))
          ]);
        }))
      ]))
    ])
  ];
}

function barras(pares) {
  if (!pares.length) return el('div', { class: 'vazio-convite' }, 'Nenhum desvio registrado.');
  const max = pares[0][1];
  return el('div', { class: 'pilha', style: { gap: '8px' } }, pares.slice(0, 10).map(([nome, n]) => el('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr 34px', gap: '10px', alignItems: 'center', fontSize: '13.5px' } }, [
    el('span', { style: { color: 'var(--text-1)' } }, nome),
    el('span', { style: { height: '12px', borderRadius: '0 4px 4px 0', background: 'var(--accent-500)', width: `${(n / max) * 100}%`, minWidth: '4px' }, title: `${n} dias` }),
    el('strong', { class: 'num', style: { fontSize: '17px', textAlign: 'right' } }, String(n))
  ])));
}
