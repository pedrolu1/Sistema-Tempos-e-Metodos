import { el } from '../../utils/dom.js';
import { field } from '../../components/ui.js';
import { referenceBars } from '../../components/charts.js';
import { icon } from '../../utils/icons.js';
import { formatMinutes, formatDateBR, classificacaoBreakdown } from '../../utils/format.js';
import { minutosUteisDia } from '../../utils/planejamento.js';
import { taktTime, pct, num } from '../../utils/estudos.js';
import { projetosAtivos } from '../../lib/projetos.js';
import { inputNum, inputTexto, resultadoTile, resultadoGrid, formula } from './comum.js';

function diasEntre(a, b) {
  return Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000) + 1;
}

/** Tudo que o estudo mostra, calculado a partir do estado + dados atuais. */
function calcular(st, ctx) {
  const projeto = (ctx.projetos || []).find((p) => p.id === st.projetoId);
  const etapas = projeto?.etapas || [];
  const disponivel = Number(st.disponivelMin) || 0;
  const takt = taktTime(disponivel, st.demanda);
  const acima = etapas.filter((e) => takt > 0 && (e.duracaoMin || 0) > takt);

  const planejadoMin = etapas.reduce((s, e) => s + (e.duracaoMin || 0), 0);
  const leadPlanDias = disponivel > 0 ? planejadoMin / disponivel : 0;

  const ls = (ctx.lancamentos || []).filter((l) => l.projetoId === st.projetoId && l.data);
  const datas = ls.map((l) => l.data).sort();
  const leadRealDias = datas.length ? diasEntre(datas[0], datas[datas.length - 1]) : 0;
  const vaMin = ls.reduce((s, l) => s + classificacaoBreakdown(l).VA, 0);
  const apontadoMin = ls.reduce((s, l) => s + (Number(l.duracaoMinutos) || 0), 0);
  // eficiência do ciclo do processo (PCE): quanto do lead time foi valor agregado
  const pce = leadRealDias && disponivel ? vaMin / (leadRealDias * disponivel) : 0;

  return { projeto, etapas, disponivel, takt, acima, planejadoMin, leadPlanDias, leadRealDias, vaMin, apontadoMin, pce, inicio: datas[0], fim: datas[datas.length - 1] };
}

export const taktLeadDef = {
  tipo: 'takt',
  nome: 'Takt time e Lead time',
  resumo: 'Compare o ritmo exigido pela demanda com o tempo de cada etapa e o prazo total.',
  formula: 'Takt = tempo disponível ÷ demanda',
  iconeHtml: icon.bolt(22),
  campo: false,

  estadoInicial() {
    return { projetoId: '', disponivelMin: '', demanda: '', unidade: 'unidade' };
  },

  passos(ctx) {
    const projetos = projetosAtivos(ctx.projetos || []);
    return [
      {
        titulo: 'Projeto e tempo disponível',
        ajuda: [
          'O tempo disponível é quanto a equipe realmente tem para produzir por dia: jornada menos almoço, vezes o número de turmas.',
          'Ele vem da ficha do projeto, mas você pode ajustar (ex.: descontar o DDS).'
        ],
        render: (st, atualizar) => {
          const sel = el('select', { class: 'select', onchange: (e) => {
            st.projetoId = e.target.value;
            const p = projetos.find((x) => x.id === st.projetoId);
            st.disponivelMin = p ? minutosUteisDia(p.ficha || {}) * (Number(p.ficha?.turmas) || 1) : '';
            atualizar();
          } }, [
            el('option', { value: '' }, 'Selecione o projeto…'),
            ...projetos.map((p) => el('option', { value: p.id, selected: p.id === st.projetoId }, `${p.nome} — ${p.contratoNome}`))
          ]);
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
            field({ label: 'Projeto', input: sel }),
            field({ label: 'Tempo disponível por dia (minutos)', hint: st.disponivelMin ? `= ${formatMinutes(st.disponivelMin)} por dia` : null, input: inputNum(st.disponivelMin, (v) => { st.disponivelMin = v; atualizar(); }, { min: '0', step: '10' }) })
          ]);
        },
        validar: (st) => (!st.projetoId ? 'Escolha o projeto.' : !(Number(st.disponivelMin) > 0) ? 'Informe o tempo disponível.' : null)
      },
      {
        titulo: 'Demanda',
        ajuda: [
          'Demanda é quanto precisa ser entregue por dia para cumprir o prazo — por exemplo, 2 dutos por dia ou 12 m² por dia.',
          'Takt time = tempo disponível ÷ demanda: é o "compasso" que a obra precisa seguir para entregar no prazo.'
        ],
        render: (st, atualizar) => {
          const r = calcular(st, ctx);
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
            el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }, [
              field({ label: 'Demanda por dia', input: inputNum(st.demanda, (v) => { st.demanda = v; atualizar(); }, { min: '0', step: '0.5', placeholder: 'Ex.: 2' }) }),
              field({ label: 'Unidade', input: inputTexto(st.unidade, (v) => { st.unidade = v; atualizar({ repintar: false }); }, { placeholder: 'duto, m², forno…' }) })
            ]),
            r.takt ? formula([['Disponível', formatMinutes(r.disponivel)], '÷', ['Demanda', `${num(st.demanda, 1)} ${st.unidade}`], '=', ['Takt', formatMinutes(r.takt)]]) : null
          ]);
        },
        validar: (st) => (!(Number(st.demanda) > 0) ? 'Informe a demanda por dia.' : null)
      },
      {
        titulo: 'Etapas × takt',
        ajuda: [
          'Cada etapa precisa caber dentro do takt. As que passam da linha são gargalos: vão segurar o fluxo e atrasar a entrega.',
          'Para resolver um gargalo: dividir a etapa, reforçar a equipe nela ou eliminar desperdícios (esperas, deslocamentos).'
        ],
        render: (st) => {
          const r = calcular(st, ctx);
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
            r.etapas.length
              ? referenceBars({ data: r.etapas.map((e) => ({ label: e.codigo ? `${e.codigo} — ${e.nome}` : e.nome, value: e.duracaoMin || 0 })), reference: r.takt, referenceLabel: 'Takt', aboveLabel: 'gargalo' })
              : el('div', { class: 'muted' }, 'O projeto ainda não tem etapas planejadas.'),
            el('div', { class: `inline-alert ${r.acima.length ? 'warn' : 'info'}` }, [
              el('span', { html: r.acima.length ? icon.alert(15) : icon.check(15), style: { display: 'inline-flex' } }),
              el('div', {}, r.acima.length ? `${r.acima.length} etapa(s) acima do takt — são os gargalos do projeto.` : 'Todas as etapas cabem no takt.')
            ])
          ]);
        }
      },
      {
        titulo: 'Lead time',
        ajuda: [
          'Lead time é o tempo total do início ao fim do projeto. O planejado soma as etapas; o real vai do primeiro ao último apontamento.',
          'A eficiência do ciclo (PCE) mostra quanto desse tempo foi Valor Agregado. Processos enxutos passam de 25%; a maioria fica bem abaixo — e é aí que está a oportunidade.'
        ],
        render: (st) => taktLeadDef.detalhe({ dados: st }, ctx, true)
      }
    ];
  },

  salvar(st, ctx) {
    const r = calcular(st, ctx);
    return {
      titulo: r.projeto?.nome || 'Takt e lead time',
      alvo: { projetoId: st.projetoId, projetoNome: r.projeto?.nome || '', contratoNome: r.projeto?.contratoNome || '' },
      dados: { ...st, _passo: 0 },
      resultado: {
        principal: `Takt ${formatMinutes(r.takt)} · ${r.acima.length} gargalo(s)`,
        taktMin: r.takt,
        gargalos: r.acima.map((e) => e.nome),
        leadPlanDias: r.leadPlanDias,
        leadRealDias: r.leadRealDias,
        pce: r.pce
      }
    };
  },

  detalhe(estudo, ctx, noAssistente = false) {
    const st = estudo.dados || {};
    const r = calcular(st, ctx);
    return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, [
      resultadoGrid([
        resultadoTile('Takt time', formatMinutes(r.takt), `por ${st.unidade}`, true),
        resultadoTile('Gargalos', String(r.acima.length), 'etapas acima do takt'),
        resultadoTile('Lead time planejado', `${num(r.leadPlanDias, 1)} dias`, `${formatMinutes(r.planejadoMin)} de etapas`),
        resultadoTile('Lead time real', r.leadRealDias ? `${r.leadRealDias} dias` : '—', r.inicio ? `${formatDateBR(r.inicio)} a ${formatDateBR(r.fim)}` : 'sem apontamentos'),
        resultadoTile('Eficiência (PCE)', r.leadRealDias ? pct(r.pce, 1) : '—', `${formatMinutes(r.vaMin)} de valor agregado`)
      ]),
      !noAssistente && r.etapas.length
        ? referenceBars({ data: r.etapas.map((e) => ({ label: e.codigo ? `${e.codigo} — ${e.nome}` : e.nome, value: e.duracaoMin || 0 })), reference: r.takt, referenceLabel: 'Takt', aboveLabel: 'gargalo' })
        : null,
      !noAssistente && !r.projeto ? el('div', { class: 'muted' }, 'O projeto deste estudo foi removido ou concluído.') : null
    ]);
  }
};
