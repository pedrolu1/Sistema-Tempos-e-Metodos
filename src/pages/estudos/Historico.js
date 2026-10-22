import { el } from '../../utils/dom.js';
import { field, segmented } from '../../components/ui.js';
import { icon } from '../../utils/icons.js';
import { formatMinutes } from '../../utils/format.js';
import { estatisticas, percentil, pct } from '../../utils/estudos.js';
import { updateAtividade } from '../../lib/activities.js';
import { inputNum, resultadoTile, resultadoGrid } from './comum.js';

const BASES = [
  { value: 'mediana', label: 'Mediana', desc: 'o tempo "do meio": metade foi mais rápida, metade mais lenta' },
  { value: 'media', label: 'Média', desc: 'soma ÷ quantidade — sensível a valores extremos' },
  { value: 'p85', label: 'P85', desc: '85% das vezes terminou dentro deste tempo — mais folgado' }
];

/** Agrupa os apontamentos produtivos por atividade e calcula as estatísticas de cada uma. */
function calcular(st, ctx) {
  const ls = (ctx.lancamentos || []).filter((l) =>
    l.tipoRegistro !== 'improdutividade' &&
    Number(l.duracaoMinutos) > 0 &&
    (!st.de || l.data >= st.de) &&
    (!st.ate || l.data <= st.ate) &&
    (!st.contrato || l.contrato === st.contrato) &&
    (!st.projetoId || l.projetoId === st.projetoId)
  );
  const grupos = new Map();
  ls.forEach((l) => {
    const k = l.atividadeId || l.atividadeNome;
    if (!grupos.has(k)) grupos.set(k, { atividadeId: l.atividadeId, nome: l.atividadeNome, tempos: [] });
    grupos.get(k).tempos.push(Number(l.duracaoMinutos));
  });
  const linhas = [...grupos.values()]
    .filter((g) => g.tempos.length >= (Number(st.minAmostras) || 1))
    .map((g) => {
      const est = estatisticas(g.tempos);
      const valores = { media: est.media, mediana: percentil(g.tempos, 0.5), p85: percentil(g.tempos, 0.85) };
      const atividade = (ctx.atividades || []).find((a) => a.id === g.atividadeId);
      return { ...g, ...est, ...valores, padraoAtual: atividade?.duracaoPadraoMin || 0, sugerido: Math.round(valores[st.base] || 0), noCatalogo: !!atividade };
    })
    .sort((a, b) => b.n - a.n);
  return { linhas, total: ls.length };
}

function tabela(st, ctx, atualizar, editavel) {
  const { linhas } = calcular(st, ctx);
  if (!linhas.length) {
    return el('div', { class: 'muted', style: { padding: '18px 0' } }, 'Nenhuma atividade com amostras suficientes nesse filtro.');
  }
  return el('div', { class: 'table-wrap' }, [
    el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, [editavel ? 'Atualizar' : null, 'Atividade', 'Amostras', 'Média', 'Mediana', 'P85', 'Variação', 'Padrão atual', 'Sugerido'].filter(Boolean).map((h) => el('th', {}, h)))),
      el('tbody', {}, linhas.map((l) => {
        const instavel = l.cv > 0.3;
        return el('tr', {}, [
          editavel
            ? el('td', {}, el('input', { type: 'checkbox', disabled: !l.noCatalogo, checked: !!st.aplicar[l.atividadeId], style: { width: '17px', height: '17px', accentColor: 'var(--accent-500)' },
                onchange: (e) => { st.aplicar[l.atividadeId] = e.target.checked; atualizar({ repintar: false }); } }))
            : null,
          el('td', { class: 'strong' }, l.nome || '—'),
          el('td', { class: 'mono' }, String(l.n)),
          el('td', { class: 'mono' }, formatMinutes(l.media)),
          el('td', { class: 'mono' }, formatMinutes(l.mediana)),
          el('td', { class: 'mono' }, formatMinutes(l.p85)),
          el('td', { class: 'mono', style: { color: instavel ? 'var(--warn-500)' : 'var(--text-1)' }, title: instavel ? 'Variação alta (> 30%): o processo está instável' : '' }, `${pct(l.cv)}${instavel ? ' ⚠' : ''}`),
          el('td', { class: 'mono muted' }, l.padraoAtual ? formatMinutes(l.padraoAtual) : '—'),
          el('td', { class: 'mono', style: { fontWeight: '700', color: 'var(--accent-300)' } }, formatMinutes(l.sugerido))
        ].filter(Boolean));
      }))
    ])
  ]);
}

export const historicoDef = {
  tipo: 'historico',
  nome: 'Tempos históricos',
  resumo: 'Use os apontamentos já feitos para definir o tempo padrão de cada atividade.',
  formula: 'Padrão = mediana dos tempos reais',
  iconeHtml: icon.list(22),
  campo: false,

  estadoInicial() {
    return { de: '', ate: '', contrato: '', projetoId: '', minAmostras: 3, base: 'mediana', aplicar: {}, aplicarAoSalvar: true };
  },

  passos(ctx) {
    const contratos = [...new Set((ctx.lancamentos || []).map((l) => l.contrato).filter(Boolean))].sort();
    return [
      {
        titulo: 'Quais apontamentos usar',
        ajuda: [
          'O tempo histórico usa o que já foi apontado em campo: se uma atividade foi feita muitas vezes, os tempos reais mostram quanto ela costuma levar.',
          'Filtre o período e, se quiser, um contrato ou projeto. "Mínimo de amostras" evita conclusões com poucos dados.'
        ],
        render: (st, atualizar) => {
          const { total } = calcular(st, ctx);
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
            el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }, [
              field({ label: 'De', input: el('input', { class: 'input', type: 'date', value: st.de, onchange: (e) => { st.de = e.target.value; atualizar(); } }) }),
              field({ label: 'Até', input: el('input', { class: 'input', type: 'date', value: st.ate, onchange: (e) => { st.ate = e.target.value; atualizar(); } }) })
            ]),
            el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }, [
              field({ label: 'Contrato', input: el('select', { class: 'select', onchange: (e) => { st.contrato = e.target.value; atualizar(); } }, [
                el('option', { value: '' }, 'Todos'),
                ...contratos.map((c) => el('option', { value: c, selected: c === st.contrato }, c))
              ]) }),
              field({ label: 'Projeto', input: el('select', { class: 'select', onchange: (e) => { st.projetoId = e.target.value; atualizar(); } }, [
                el('option', { value: '' }, 'Todos'),
                ...(ctx.projetos || []).map((p) => el('option', { value: p.id, selected: p.id === st.projetoId }, p.nome))
              ]) })
            ]),
            field({ label: 'Mínimo de amostras por atividade', input: inputNum(st.minAmostras, (v) => { st.minAmostras = Math.max(1, Number(v) || 1); atualizar(); }, { min: '1', step: '1' }) }),
            resultadoGrid([resultadoTile('Apontamentos no filtro', String(total), 'atividades produtivas', true)])
          ]);
        },
        validar: (st) => (calcular(st, ctx).linhas.length ? null : 'Nenhuma atividade tem amostras suficientes com esse filtro.')
      },
      {
        titulo: 'Tempos por atividade',
        ajuda: [
          'Escolha a base do tempo sugerido. A mediana é a mais segura: não é puxada por um dia atípico.',
          'Variação acima de 30% (⚠) indica processo instável — vale investigar antes de fixar um padrão. Marque as atividades que devem ter o padrão atualizado.'
        ],
        render: (st, atualizar) => {
          const tabs = segmented(BASES.map((b) => ({ value: b.value, label: b.label })), st.base, (v) => { st.base = v; atualizar(); });
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
            el('div', { class: 'toolbar' }, [tabs, el('span', { class: 'muted', style: { fontSize: '12.5px' } }, BASES.find((b) => b.value === st.base).desc)]),
            tabela(st, ctx, atualizar, true)
          ]);
        }
      },
      {
        titulo: 'Confirmar',
        ajuda: 'Ao salvar, o estudo fica registrado. Se a opção abaixo estiver marcada, o tempo padrão geral das atividades escolhidas é atualizado (vale para lançamentos sem projeto). Para mudar um projeto, ajuste a duração dentro dele.',
        render: (st, atualizar) => {
          const escolhidas = calcular(st, ctx).linhas.filter((l) => st.aplicar[l.atividadeId]);
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
            escolhidas.length
              ? el('div', { class: 'tol-list' }, escolhidas.map((l) => el('div', { class: 'tol-item' }, [
                  el('span', {}, l.nome),
                  el('span', { class: 'mono muted' }, `${l.padraoAtual ? formatMinutes(l.padraoAtual) : 'sem padrão'} → `),
                  el('b', { class: 'mono', style: { color: 'var(--accent-300)' } }, formatMinutes(l.sugerido))
                ])))
              : el('div', { class: 'muted' }, 'Nenhuma atividade marcada — o estudo será salvo só como consulta.'),
            escolhidas.length
              ? el('label', { class: 'tol-item' }, [
                  el('input', { type: 'checkbox', checked: st.aplicarAoSalvar, onchange: (e) => { st.aplicarAoSalvar = e.target.checked; atualizar({ repintar: false }); } }),
                  el('span', {}, `Atualizar o tempo padrão geral de ${escolhidas.length} atividade(s)`)
                ])
              : null
          ]);
        }
      }
    ];
  },

  salvar(st, ctx) {
    const { linhas, total } = calcular(st, ctx);
    return {
      titulo: `Histórico${st.contrato ? ` — ${st.contrato}` : ''}`,
      alvo: { contratoNome: st.contrato, projetoId: st.projetoId },
      dados: { ...st, _passo: 0, linhas: linhas.map(({ tempos, ...l }) => l) },
      resultado: { principal: `${linhas.length} atividade(s) · ${total} apontamentos`, atividades: linhas.length, apontamentos: total }
    };
  },

  /** Aplica os padrões gerais marcados (só quando o gestor confirma). */
  async aposSalvar(st, ctx) {
    if (!st.aplicarAoSalvar) return;
    const escolhidas = calcular(st, ctx).linhas.filter((l) => st.aplicar[l.atividadeId] && l.noCatalogo && l.sugerido > 0);
    await Promise.all(escolhidas.map((l) => updateAtividade(l.atividadeId, { duracaoPadraoMin: l.sugerido })));
  },

  detalhe(estudo) {
    const linhas = estudo.dados?.linhas || [];
    const base = BASES.find((b) => b.value === estudo.dados?.base) || BASES[0];
    return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
      el('div', { class: 'muted', style: { fontSize: '12.5px' } }, `Base do sugerido: ${base.label} · retrato salvo em ${new Date(estudo.criadoEmLocal || Date.now()).toLocaleDateString('pt-BR')}`),
      el('div', { class: 'table-wrap' }, [
        el('table', { class: 'data-table' }, [
          el('thead', {}, el('tr', {}, ['Atividade', 'Amostras', 'Média', 'Mediana', 'P85', 'Variação', 'Sugerido'].map((h) => el('th', {}, h)))),
          el('tbody', {}, linhas.map((l) => el('tr', {}, [
            el('td', { class: 'strong' }, l.nome || '—'),
            el('td', { class: 'mono' }, String(l.n)),
            el('td', { class: 'mono' }, formatMinutes(l.media)),
            el('td', { class: 'mono' }, formatMinutes(l.mediana)),
            el('td', { class: 'mono' }, formatMinutes(l.p85)),
            el('td', { class: 'mono' }, pct(l.cv)),
            el('td', { class: 'mono', style: { fontWeight: '700', color: 'var(--accent-300)' } }, formatMinutes(l.sugerido))
          ])))
        ])
      ])
    ]);
  }
};
