import { el } from '../../utils/dom.js';
import { field, button } from '../../components/ui.js';
import { icon } from '../../utils/icons.js';
import { formatMinutes } from '../../utils/format.js';
import { MTM_BIBLIOTECA, mtmTotal, somaTolerancias, fatorTolerancia, toleranciasPadrao, formatSeg, num } from '../../utils/estudos.js';
import { alvoPicker, alvoTexto, inputNum, inputTexto, toleranciasEditor, resultadoTile, resultadoGrid, formula, acoesAplicar } from './comum.js';

function calcular(st) {
  const { tmu, seg } = mtmTotal(st.elementos);
  const ft = fatorTolerancia(somaTolerancias(st.tolerancias));
  const tp = seg * ft;
  const qtd = Number(st.quantidade) || 0;
  return { tmu, tn: seg, ft, tp, etapaMin: qtd > 0 ? (tp * qtd) / 60 : 0 };
}

export const mtmDef = {
  tipo: 'mtm',
  nome: 'MTM — tempos predeterminados',
  resumo: 'Monte a tarefa movimento por movimento e obtenha o tempo sem cronômetro.',
  formula: '1 TMU = 0,036 s',
  iconeHtml: icon.grid(22),
  campo: true,

  estadoInicial() {
    return { alvo: {}, operacao: '', elementos: [], grupo: 0, tolerancias: toleranciasPadrao(), quantidade: '', customNome: '', customTmu: '' };
  },

  passos(ctx) {
    return [
      {
        titulo: 'Operação',
        ajuda: [
          'No MTM (Methods-Time Measurement) cada movimento básico — alcançar, pegar, mover, posicionar, soltar — tem um tempo tabelado em TMU.',
          'Somando os movimentos da tarefa, você tem o tempo normal sem precisar cronometrar. Ótimo para tarefas novas ou para comparar métodos antes de executar.'
        ],
        render: (st, atualizar) => el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
          alvoPicker(st, ctx, atualizar),
          field({ label: 'Operação analisada', input: inputTexto(st.operacao, (v) => { st.operacao = v; atualizar({ repintar: false }); }, { placeholder: 'Ex.: pegar tijolo do palete e posicionar na fiada' }) })
        ]),
        validar: (st) => (!st.operacao.trim() ? 'Descreva a operação.' : null)
      },
      {
        titulo: 'Movimentos',
        ajuda: [
          'Toque em "+" para incluir cada movimento na ordem em que acontece. Ajuste quantas vezes ele se repete no ciclo.',
          'Os valores são de referência MTM-1 (peças leves). Para cargas acima de ~1 kg ou movimentos especiais, crie um elemento próprio com o TMU da sua tabela.'
        ],
        render: (st, atualizar) => {
          const grupo = MTM_BIBLIOTECA[st.grupo] || MTM_BIBLIOTECA[0];
          const { tmu, seg } = mtmTotal(st.elementos);
          const add = (item) => { st.elementos.push({ ...item, freq: 1 }); atualizar(); };
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
            el('div', { class: 'mtm-tabs' }, MTM_BIBLIOTECA.map((g, i) => el('button', { type: 'button', class: i === st.grupo ? 'on' : '', onclick: () => { st.grupo = i; atualizar(); } }, g.grupo))),
            el('div', { class: 'check-list' }, grupo.itens.map((it) => el('div', { class: 'check-item' }, [
              el('span', { class: 'mono muted', style: { minWidth: '44px' } }, it.cod),
              el('span', { style: { flex: '1' } }, it.nome),
              el('span', { class: 'mono muted' }, `${num(it.tmu, 1)} TMU`),
              button({ iconOnly: true, size: 'sm', variant: 'outline', icon: icon.plus(14), onClick: () => add(it) })
            ]))),
            el('details', { class: 'manual' }, [
              el('summary', {}, 'Criar elemento próprio'),
              el('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px', marginTop: '10px' } }, [
                inputTexto(st.customNome, (v) => { st.customNome = v; atualizar({ repintar: false }); }, { placeholder: 'Descrição' }),
                inputNum(st.customTmu, (v) => { st.customTmu = v; atualizar({ repintar: false }); }, { placeholder: 'TMU', min: '0', step: '0.1' }),
                button({ label: 'Incluir', variant: 'outline', onClick: () => {
                  if (!st.customNome.trim() || !(Number(st.customTmu) > 0)) return;
                  const item = { cod: 'PRÓPRIO', nome: st.customNome.trim(), tmu: Number(st.customTmu) };
                  st.customNome = '';
                  st.customTmu = '';
                  add(item);
                } })
              ])
            ]),
            el('div', { class: 'field-label' }, `Sequência da operação (${st.elementos.length})`),
            st.elementos.length
              ? el('div', { class: 'tol-list' }, st.elementos.map((e, i) => el('div', { class: 'tol-item' }, [
                  el('span', { class: 'mono muted', style: { minWidth: '44px' } }, e.cod),
                  el('span', { style: { flex: '1' } }, e.nome),
                  el('span', { class: 'tol-pct' }, [
                    inputNum(e.freq, (v) => { e.freq = Math.max(0, Number(v) || 0); atualizar(); }, { class: 'input mono input-compact', min: '0', step: '1', title: 'Vezes por ciclo' }),
                    '×'
                  ]),
                  button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.trash(14), onClick: () => { st.elementos.splice(i, 1); atualizar(); } })
                ])))
              : el('div', { class: 'muted', style: { fontSize: '13px' } }, 'Nenhum movimento ainda.'),
            formula([['Total', `${num(tmu, 1)} TMU`], '×', ['1 TMU', '0,036 s'], '=', ['TN', formatSeg(seg)]])
          ]);
        },
        validar: (st) => (!st.elementos.length ? 'Inclua pelo menos um movimento.' : null)
      },
      {
        titulo: 'Tolerâncias',
        ajuda: 'O tempo do MTM já está em ritmo normal (não precisa de fator de ritmo). Falta somar as tolerâncias: FT = 1 ÷ (1 − p).',
        render: (st, atualizar) => toleranciasEditor(st, atualizar)
      },
      {
        titulo: 'Resultado',
        ajuda: 'Tempo padrão: TP = TN × FT. Informe quantas vezes a operação se repete na etapa para obter a duração dela.',
        render: (st, atualizar) => {
          const r = calcular(st);
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
            formula([['TN', formatSeg(r.tn)], '×', ['FT', num(r.ft, 3)], '=', ['TP', formatSeg(r.tp)]]),
            resultadoGrid([
              resultadoTile('Tempo padrão (TP)', formatSeg(r.tp), 'por ciclo', true),
              resultadoTile('Movimentos', String(st.elementos.length), `${num(r.tmu, 1)} TMU`)
            ]),
            field({ label: 'Repetições na etapa', hint: r.etapaMin ? `Duração da etapa: ${formatMinutes(r.etapaMin)}.` : 'Opcional.', input: inputNum(st.quantidade, (v) => { st.quantidade = v; atualizar(); }, { min: '0', step: '1', placeholder: 'Ex.: 200' }) })
          ]);
        }
      }
    ];
  },

  salvar(st) {
    const r = calcular(st);
    return {
      titulo: st.operacao || 'Estudo MTM',
      alvo: st.alvo,
      dados: { ...st, _passo: 0 },
      resultado: { principal: `TP ${formatSeg(r.tp)} / ciclo`, tmu: r.tmu, tnSeg: r.tn, tpSeg: r.tp, ft: r.ft, etapaMin: r.etapaMin }
    };
  },

  detalhe(estudo, ctx) {
    const st = estudo.dados || {};
    const r = calcular(st);
    return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
      formula([['TN', formatSeg(r.tn)], '×', ['FT', num(r.ft, 3)], '=', ['TP', formatSeg(r.tp)]]),
      resultadoGrid([
        resultadoTile('Tempo padrão (TP)', formatSeg(r.tp), 'por ciclo', true),
        resultadoTile('Total', `${num(r.tmu, 1)} TMU`, `${st.elementos.length} movimentos`),
        r.etapaMin ? resultadoTile('Duração da etapa', formatMinutes(r.etapaMin), `${st.quantidade} repetições`) : null
      ].filter(Boolean)),
      el('div', { class: 'tol-list' }, st.elementos.map((e) => el('div', { class: 'tol-item' }, [
        el('span', { class: 'mono muted', style: { minWidth: '44px' } }, e.cod),
        el('span', { style: { flex: '1' } }, e.nome),
        el('span', { class: 'mono muted' }, `${e.freq} × ${num(e.tmu, 1)}`)
      ]))),
      el('div', { class: 'muted', style: { fontSize: '12.5px' } }, alvoTexto(estudo.alvo)),
      acoesAplicar(estudo, ctx, r.etapaMin)
    ]);
  }
};
