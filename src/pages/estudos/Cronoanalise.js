import { el, mount } from '../../utils/dom.js';
import { field, button } from '../../components/ui.js';
import { icon } from '../../utils/icons.js';
import { formatMinutes } from '../../utils/format.js';
import { cronoanalise as calcular, estatisticas, foraDaCurva, toleranciasPadrao, formatSeg, num, pct } from '../../utils/estudos.js';
import { alvoPicker, alvoTexto, escolhas, inputNum, inputTexto, toleranciasEditor, precisaoEditor, resultadoTile, resultadoGrid, formula, acoesAplicar } from './comum.js';

const RITMOS = [
  { value: 0.8, label: '80%', desc: 'Bem devagar' },
  { value: 0.9, label: '90%', desc: 'Um pouco devagar' },
  { value: 1, label: '100%', desc: 'Normal' },
  { value: 1.1, label: '110%', desc: 'Um pouco rápido' },
  { value: 1.2, label: '120%', desc: 'Bem rápido' }
];

/** Cronômetro de ciclos — o coração da cronoanálise em campo. */
function passoCronometro(st, atualizar) {
  const display = el('div', { class: 'stopwatch-time mono' }, '0,0 s');
  const statsBox = el('div');
  let timer = null;

  const marcar = () => {
    const agora = Date.now();
    st.leituras.push(Math.round((agora - st.rodandoDesde) / 100) / 10);
    st.rodandoDesde = agora; // o próximo ciclo começa no mesmo instante
    navigator.vibrate?.(30);
    atualizar();
  };
  const iniciar = () => {
    st.rodandoDesde = Date.now();
    atualizar();
  };
  const parar = () => {
    st.rodandoDesde = null;
    atualizar();
  };
  const desfazer = () => {
    st.leituras.pop();
    st.descartadas = st.descartadas.filter((i) => i < st.leituras.length);
    atualizar();
  };
  const alternarDescarte = (i) => {
    st.descartadas = st.descartadas.includes(i) ? st.descartadas.filter((x) => x !== i) : [...st.descartadas, i];
    atualizar();
  };

  const tick = () => {
    if (st.rodandoDesde) display.textContent = formatSeg((Date.now() - st.rodandoDesde) / 1000);
  };
  if (st.rodandoDesde) {
    tick();
    timer = setInterval(tick, 100);
  }

  const r = calcular(st);
  const fora = foraDaCurva(st.leituras);
  const faltam = Math.max(0, r.necessarios - r.n);
  mount(statsBox, [
    resultadoGrid([
      resultadoTile('Ciclos válidos', String(r.n)),
      resultadoTile('Média (TC)', r.n ? formatSeg(r.tc) : '—'),
      resultadoTile('Necessários', r.n >= 2 ? String(r.necessarios) : '—', `${pct(st.confianca)} · ±${pct(st.erro)}`)
    ]),
    r.n >= 2
      ? el('div', { class: `inline-alert ${faltam ? 'warn' : 'info'}` }, [
          el('span', { html: faltam ? icon.alert(15) : icon.check(15), style: { display: 'inline-flex', flexShrink: '0' } }),
          el('div', {}, faltam ? `Faltam ${faltam} ciclo(s) para o resultado ser confiável.` : 'Ciclos suficientes — o resultado já é confiável.')
        ])
      : null
  ]);

  const manual = el('input', { class: 'input mono', type: 'number', inputmode: 'decimal', min: '0', step: '0.1', placeholder: 'Ex.: 42,5' });
  const addManual = () => {
    const v = Number(String(manual.value).replace(',', '.'));
    if (!(v > 0)) return;
    st.leituras.push(Math.round(v * 10) / 10);
    atualizar();
  };

  const node = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, [
    el('div', { class: `stopwatch${st.rodandoDesde ? ' running' : ''}` }, [
      el('small', {}, st.rodandoDesde ? `Ciclo ${st.leituras.length + 1} em andamento` : st.leituras.length ? 'Cronômetro parado' : 'Pronto para começar'),
      display,
      st.rodandoDesde
        ? el('button', { class: 'stopwatch-main', type: 'button', onclick: marcar }, [el('span', { html: icon.check(26) }), 'Terminou o ciclo'])
        : el('button', { class: 'stopwatch-main', type: 'button', onclick: iniciar }, [el('span', { html: icon.clock(26) }), st.leituras.length ? 'Continuar' : 'Iniciar']),
      el('div', { class: 'toolbar', style: { justifyContent: 'center' } }, [
        st.rodandoDesde ? button({ label: 'Parar', variant: 'ghost', size: 'sm', icon: icon.x(14), onClick: parar }) : null,
        st.leituras.length ? button({ label: 'Desfazer último', variant: 'ghost', size: 'sm', onClick: desfazer }) : null
      ])
    ]),
    statsBox,
    st.leituras.length
      ? el('div', {}, [
          el('div', { class: 'field-label', style: { marginBottom: '8px' } }, 'Leituras — toque para descartar ou recuperar'),
          el('div', { class: 'chip-row' }, st.leituras.map((v, i) => {
            const desc = st.descartadas.includes(i);
            return el('button', { type: 'button', class: `reading${desc ? ' off' : ''}${fora.includes(i) && !desc ? ' out' : ''}`, onclick: () => alternarDescarte(i), title: fora.includes(i) ? 'Fora da curva (média ± 2 desvios)' : '' }, [
              el('small', {}, `#${i + 1}`),
              formatSeg(v)
            ]);
          })),
          fora.some((i) => !st.descartadas.includes(i))
            ? el('div', { class: 'field-hint', style: { color: 'var(--warn-500)' } }, 'Leituras em amarelo estão fora da curva — se houve interrupção nesse ciclo, toque para descartar.')
            : null
        ])
      : null,
    el('details', { class: 'manual' }, [
      el('summary', {}, 'Digitar tempos (já medidos em outro cronômetro)'),
      el('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } }, [manual, button({ label: 'Adicionar', variant: 'outline', onClick: addManual })])
    ])
  ]);

  return { node, destruir: () => clearInterval(timer) };
}

export const cronoanaliseDef = {
  tipo: 'cronoanalise',
  nome: 'Cronoanálise',
  resumo: 'Cronometre os ciclos de uma tarefa e descubra o tempo padrão.',
  formula: 'TP = TC × FR × FT',
  iconeHtml: icon.clock(22),
  campo: true,

  estadoInicial() {
    return { alvo: {}, operacao: '', unidade: 'ciclo', operador: '', leituras: [], descartadas: [], rodandoDesde: null, ritmo: 1, tolerancias: toleranciasPadrao(), confianca: 0.95, erro: 0.05, quantidade: '' };
  },

  passos(ctx) {
    return [
      {
        titulo: 'O que será medido',
        ajuda: [
          'A cronoanálise mede quanto tempo uma tarefa repetitiva leva. Você cronometra várias vezes a mesma tarefa (cada vez é um "ciclo") e o app calcula o tempo justo para ela.',
          'Exemplo: medir o assentamento de 1 tijolo refratário — cada tijolo assentado é 1 ciclo.'
        ],
        render: (st, atualizar) => el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
          alvoPicker(st, ctx, atualizar),
          field({ label: 'Tarefa cronometrada', input: inputTexto(st.operacao, (v) => { st.operacao = v; atualizar({ repintar: false }); }, { placeholder: 'Ex.: assentar 1 tijolo refratário' }) }),
          el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }, [
            field({ label: '1 ciclo é…', input: inputTexto(st.unidade, (v) => { st.unidade = v; atualizar({ repintar: false }); }, { placeholder: 'ciclo, tijolo, m²…' }) }),
            field({ label: 'Operador observado', input: inputTexto(st.operador, (v) => { st.operador = v; atualizar({ repintar: false }); }, { placeholder: 'Opcional' }) })
          ])
        ]),
        validar: (st) => (!st.operacao.trim() && !st.alvo?.atividadeId ? 'Diga qual tarefa será cronometrada.' : null)
      },
      {
        titulo: 'Cronometragem',
        ajuda: [
          'Toque em "Iniciar" quando o ciclo começar e em "Terminou o ciclo" a cada repetição — o próximo ciclo começa sozinho.',
          'Se algo atrapalhar um ciclo (parada, conversa, falta de material), toque na leitura para descartá-la. O app avisa quantos ciclos ainda faltam.'
        ],
        render: passoCronometro,
        validar: (st) => {
          if (st.rodandoDesde) return 'Pare o cronômetro antes de avançar.';
          return calcular(st).n < 3 ? 'Faça pelo menos 3 ciclos válidos.' : null;
        }
      },
      {
        titulo: 'Ritmo do operador',
        ajuda: [
          'Ninguém trabalha sempre no mesmo ritmo. Compare o operador com alguém treinado trabalhando em ritmo normal, sem pressa e sem corpo mole.',
          'Tempo Normal: TN = TC × FR (fator de ritmo). Se ele foi mais rápido que o normal, o tempo aumenta; se foi mais devagar, diminui.'
        ],
        render: (st, atualizar) => {
          const r = calcular(st);
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
            escolhas({ opcoes: RITMOS, valor: st.ritmo, aoEscolher: (v) => { st.ritmo = v; atualizar(); } }),
            field({ label: 'Ou digite o ritmo (%)', input: inputNum(Math.round(st.ritmo * 100), (v) => { st.ritmo = Math.min(1.5, Math.max(0.5, (Number(v) || 100) / 100)); atualizar(); }, { min: '50', max: '150', step: '5' }) }),
            formula([['TC', formatSeg(r.tc)], '×', ['FR', num(r.fr)], '=', ['TN', formatSeg(r.tn)]])
          ]);
        }
      },
      {
        titulo: 'Tolerâncias',
        ajuda: [
          'Tolerâncias são pausas que todo trabalhador precisa: necessidades pessoais, descanso da fadiga, calor, EPI pesado…',
          'Marque as que se aplicam. O fator de tolerância é FT = 1 ÷ (1 − p), onde p é a soma das tolerâncias. Os percentuais seguem a referência da OIT e podem ser ajustados.'
        ],
        render: (st, atualizar) => toleranciasEditor(st, atualizar)
      },
      {
        titulo: 'Resultado',
        ajuda: 'Tempo Padrão: TP = TN × FT. É o tempo justo para um trabalhador treinado fazer 1 ciclo, já com as pausas necessárias.',
        render: (st, atualizar) => {
          const r = calcular(st);
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, [
            formula([['TC', formatSeg(r.tc)], '×', ['FR', num(r.fr)], '×', ['FT', num(r.ft, 3)], '=', ['TP', formatSeg(r.tp)]]),
            resultadoGrid([
              resultadoTile('Tempo padrão (TP)', formatSeg(r.tp), `por ${st.unidade || 'ciclo'}`, true),
              resultadoTile('Produção/hora', num(r.pecasHora, 1), `${st.unidade || 'ciclo'}(s) por hora`),
              resultadoTile('Ciclos', `${r.n} de ${r.necessarios}`, 'feitos / necessários')
            ]),
            r.necessarios > r.n
              ? el('div', { class: 'inline-alert warn' }, [el('span', { html: icon.alert(15), style: { display: 'inline-flex' } }), el('div', {}, `Amostra pequena: para ${pct(st.confianca)} de confiança seriam ${r.necessarios} ciclos. O resultado pode variar.`)])
              : null,
            precisaoEditor(st, atualizar, { erroLabel: 'Erro relativo aceito' }),
            field({
              label: `Quantos "${st.unidade || 'ciclos'}" a etapa inteira tem?`,
              hint: r.etapaMin ? `Duração da etapa: ${formatMinutes(r.etapaMin)} (TP × quantidade).` : 'Opcional — com a quantidade, o app calcula a duração da etapa inteira.',
              input: inputNum(st.quantidade, (v) => { st.quantidade = v; atualizar(); }, { min: '0', step: '1', placeholder: 'Ex.: 120' })
            })
          ]);
        }
      }
    ];
  },

  salvar(st) {
    const r = calcular(st);
    return {
      titulo: st.operacao || st.alvo?.atividadeNome || 'Cronoanálise',
      alvo: st.alvo,
      dados: { ...st, rodandoDesde: null, _passo: 0 },
      resultado: {
        principal: `TP ${formatSeg(r.tp)} / ${st.unidade || 'ciclo'}`,
        tcSeg: r.tc,
        tnSeg: r.tn,
        tpSeg: r.tp,
        fr: r.fr,
        ft: r.ft,
        n: r.n,
        necessarios: r.necessarios,
        etapaMin: r.etapaMin
      }
    };
  },

  detalhe(estudo, ctx) {
    const st = estudo.dados || {};
    const r = calcular(st);
    const est = estatisticas(st.leituras.filter((_, i) => !(st.descartadas || []).includes(i)));
    return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, [
      formula([['TC', formatSeg(r.tc)], '×', ['FR', num(r.fr)], '×', ['FT', num(r.ft, 3)], '=', ['TP', formatSeg(r.tp)]]),
      resultadoGrid([
        resultadoTile('Tempo padrão (TP)', formatSeg(r.tp), `por ${st.unidade || 'ciclo'}`, true),
        resultadoTile('Tempo normal (TN)', formatSeg(r.tn)),
        resultadoTile('Produção/hora', num(r.pecasHora, 1), `${st.unidade || 'ciclo'}(s)`),
        r.etapaMin ? resultadoTile('Duração da etapa', formatMinutes(r.etapaMin), `${st.quantidade} × TP`) : null,
        resultadoTile('Ciclos', `${r.n} / ${r.necessarios}`, 'feitos / necessários'),
        resultadoTile('Variação (CV)', pct(est.cv, 1), `de ${formatSeg(est.min)} a ${formatSeg(est.max)}`)
      ].filter(Boolean)),
      el('div', { class: 'chip-row' }, st.leituras.map((v, i) => el('span', { class: `reading${(st.descartadas || []).includes(i) ? ' off' : ''}` }, [el('small', {}, `#${i + 1}`), formatSeg(v)]))),
      el('div', { class: 'muted', style: { fontSize: '12.5px' } }, `${alvoTexto(estudo.alvo)}${st.operador ? ` · operador: ${st.operador}` : ''} · ritmo ${pct(r.fr)} · tolerância ${pct(r.ft ? 1 - 1 / r.ft : 0, 1)}`),
      acoesAplicar(estudo, ctx, r.etapaMin)
    ]);
  }
};
