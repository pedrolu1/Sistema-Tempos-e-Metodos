import { el, mount } from '../../utils/dom.js';
import { field, button } from '../../components/ui.js';
import { rankingBars } from '../../components/charts.js';
import { icon } from '../../utils/icons.js';
import { formatMinutes, nowHHMM } from '../../utils/format.js';
import { minutosUteisDia } from '../../utils/planejamento.js';
import { amostragem as calcular, pct } from '../../utils/estudos.js';
import { alvoPicker, alvoTexto, precisaoEditor, resultadoTile, resultadoGrid } from './comum.js';

const CATEGORIAS_PADRAO = ['Trabalhando', 'Aguardando material', 'Aguardando liberação (APR/PT)', 'Deslocamento', 'Parado / ocioso', 'Outros'];

function resultadoDe(st) {
  const principal = st.categorias[0];
  return calcular({ contagens: st.contagens, principal, confianca: st.confianca, erro: st.erro });
}

/** Barras da proporção de cada categoria (série única: o comprimento carrega o valor). */
function barras(st) {
  const r = resultadoDe(st);
  return rankingBars({
    // 1ª categoria = produtiva (verde); as demais são perda de tempo (vermelho)
    data: st.categorias.map((c, i) => ({ id: c, label: c, value: r.proporcoes[c] || 0, color: i === 0 ? 'var(--ok-500)' : 'var(--danger-500)' })),
    valueFmt: (v) => pct(v, 1),
    emptyLabel: 'Nenhuma observação ainda.'
  });
}

export const amostragemDef = {
  tipo: 'amostragem',
  nome: 'Amostragem do trabalho',
  resumo: 'Observe a equipe em momentos sorteados e descubra quanto do tempo é produtivo.',
  formula: 'n = z² · p · (1 − p) ÷ e²',
  iconeHtml: icon.target(22),
  campo: true,

  estadoInicial() {
    return { alvo: {}, equipe: '', categorias: [...CATEGORIAS_PADRAO], contagens: {}, historico: [], confianca: 0.95, erro: 0.05, proximaRonda: '' };
  },

  passos(ctx) {
    return [
      {
        titulo: 'O que será observado',
        ajuda: [
          'Na amostragem você não cronometra: em momentos sorteados, olha para a equipe e anota o que cada pessoa está fazendo naquele instante.',
          'Depois de muitas observações, a proporção de cada situação mostra como o tempo é usado. A 1ª categoria é a "produtiva".'
        ],
        render: (st, atualizar) => {
          const lista = el('div', { class: 'tol-list' }, st.categorias.map((c, i) =>
            el('div', { class: 'tol-item' }, [
              el('span', { class: 'mono muted' }, String(i + 1)),
              el('input', { class: 'input', type: 'text', value: c, onchange: (e) => {
                const novo = e.target.value.trim() || c;
                st.contagens[novo] = st.contagens[c] || 0;
                if (novo !== c) delete st.contagens[c];
                st.historico = st.historico.map((h) => (h === c ? novo : h));
                st.categorias[i] = novo;
                atualizar({ repintar: false });
              } }),
              st.categorias.length > 2 && i > 0
                ? button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.trash(14), onClick: () => { delete st.contagens[c]; st.categorias.splice(i, 1); atualizar(); } })
                : el('span')
            ])
          ));
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
            alvoPicker(st, ctx, atualizar),
            field({ label: 'Equipe / local observado', input: el('input', { class: 'input', type: 'text', value: st.equipe, placeholder: 'Ex.: turma A — bateria 3', oninput: (e) => { st.equipe = e.target.value; atualizar({ repintar: false }); } }) }),
            el('div', { class: 'field-label' }, 'Categorias (a 1ª é a produtiva)'),
            lista,
            button({ label: 'Adicionar categoria', variant: 'ghost', size: 'sm', icon: icon.plus(14), onClick: () => { st.categorias.push(`Categoria ${st.categorias.length + 1}`); atualizar(); } })
          ]);
        }
      },
      {
        titulo: 'Precisão',
        ajuda: [
          'Quanto mais observações, mais confiável o resultado. A fórmula n = z² · p · (1 − p) ÷ e² diz quantas observações são necessárias.',
          'Começamos com o pior caso (p = 50%). Durante a coleta, o app recalcula com a proporção real.'
        ],
        render: (st, atualizar) => {
          const r = resultadoDe(st);
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
            precisaoEditor(st, atualizar),
            resultadoGrid([resultadoTile('Observações necessárias', String(r.necessarias), 'estimativa inicial', true)])
          ]);
        }
      },
      {
        titulo: 'Observações',
        ajuda: [
          'Em cada ronda, olhe para cada pessoa e toque na situação em que ela está naquele instante.',
          'Use "Sortear próxima ronda" para não observar sempre no mesmo horário — o sorteio evita que o resultado fique viciado.'
        ],
        render: (st, atualizar) => {
          const r = resultadoDe(st);
          const registrar = (c) => {
            st.contagens[c] = (st.contagens[c] || 0) + 1;
            st.historico.push(c);
            navigator.vibrate?.(20);
            atualizar();
          };
          const desfazer = () => {
            const c = st.historico.pop();
            if (c && st.contagens[c] > 0) st.contagens[c]--;
            atualizar();
          };
          const sortear = () => {
            const min = 5 + Math.floor(Math.random() * 26); // entre 5 e 30 minutos
            const [h, m] = nowHHMM().split(':').map(Number);
            const t = (h * 60 + m + min) % 1440;
            st.proximaRonda = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
            atualizar();
          };
          const progresso = Math.min(1, r.total / Math.max(1, r.necessarias));
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
            el('div', { class: 'obs-grid' }, st.categorias.map((c, i) =>
              el('button', { type: 'button', class: `obs-btn${i === 0 ? ' prod' : ''}`, onclick: () => registrar(c) }, [
                el('span', {}, c),
                el('b', { class: 'mono' }, String(st.contagens[c] || 0))
              ])
            )),
            el('div', { class: 'obs-progress' }, [
              el('div', { class: 'obs-progress-bar' }, el('span', { style: { width: `${progresso * 100}%` } })),
              el('small', {}, `${r.total} de ${r.necessarias} observações · erro atual ± ${pct(Math.min(1, r.erroAtual), 1)}`)
            ]),
            el('div', { class: 'toolbar' }, [
              button({ label: 'Sortear próxima ronda', variant: 'outline', size: 'sm', icon: icon.clock(14), onClick: sortear }),
              st.historico.length ? button({ label: 'Desfazer última', variant: 'ghost', size: 'sm', onClick: desfazer }) : null
            ]),
            st.proximaRonda ? el('div', { class: 'inline-alert info' }, [el('span', { html: icon.calendar(15), style: { display: 'inline-flex' } }), el('div', {}, `Próxima ronda às ${st.proximaRonda}.`)]) : null
          ]);
        },
        validar: (st) => (resultadoDe(st).total < 10 ? 'Faça pelo menos 10 observações.' : null)
      },
      {
        titulo: 'Resultado',
        ajuda: 'A proporção de cada situação é a parte do tempo em que a equipe fica nela. Com a jornada do projeto, o app converte em minutos por dia.',
        render: (st) => amostragemDef.detalhe({ dados: st, alvo: st.alvo }, ctx)
      }
    ];
  },

  salvar(st) {
    const r = resultadoDe(st);
    return {
      titulo: st.equipe || st.alvo?.atividadeNome || 'Amostragem do trabalho',
      alvo: st.alvo,
      dados: { ...st, _passo: 0 },
      resultado: {
        principal: `${pct(r.p, 1)} produtivo`,
        produtivo: r.p,
        total: r.total,
        necessarias: r.necessarias,
        erroAtual: r.erroAtual
      }
    };
  },

  detalhe(estudo, ctx) {
    const st = estudo.dados || {};
    const r = resultadoDe(st);
    const projeto = (ctx.projetos || []).find((p) => p.id === estudo.alvo?.projetoId);
    const uteis = projeto ? minutosUteisDia(projeto.ficha || {}) : 0;
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } });
    mount(wrap, [
      resultadoGrid([
        resultadoTile(`${st.categorias[0]}`, pct(r.p, 1), `± ${pct(Math.min(1, r.erroAtual), 1)} (${pct(st.confianca)} de confiança)`, true),
        resultadoTile('Observações', `${r.total} / ${r.necessarias}`, 'feitas / necessárias'),
        uteis ? resultadoTile('Produtivo por dia', formatMinutes(r.p * uteis), `de ${formatMinutes(uteis)} úteis`) : null
      ].filter(Boolean)),
      r.total < r.necessarias
        ? el('div', { class: 'inline-alert warn' }, [el('span', { html: icon.alert(15), style: { display: 'inline-flex' } }), el('div', {}, `Ainda faltam ${r.necessarias - r.total} observações para a margem de ± ${pct(st.erro)}.`)])
        : null,
      barras(st),
      el('div', { class: 'muted', style: { fontSize: '12.5px' } }, `${alvoTexto(estudo.alvo)}${st.equipe ? ` · ${st.equipe}` : ''}`)
    ]);
    return wrap;
  }
};
