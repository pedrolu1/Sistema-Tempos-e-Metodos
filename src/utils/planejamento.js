import { EFETIVO_CAMPOS, efetivoTotal, durationMinutes } from './format.js';

/** Minutos úteis por dia da ficha: saída − chegada − almoço. */
export function minutosUteisDia(ficha = {}) {
  const jornada = durationMinutes(ficha.horaChegada, ficha.horaSaida);
  const almoco = ficha.almocoInicio && ficha.almocoFim ? durationMinutes(ficha.almocoInicio, ficha.almocoFim) : 0;
  return Math.max(0, jornada - almoco);
}

/** Lista as funções em que o real difere do planejado: [{ label, plan, real }]. */
export function efetivoDiferencas(real = {}, plan = {}) {
  if (efetivoTotal(plan) <= 0) return [];
  return EFETIVO_CAMPOS.map((c) => ({ label: c.label, plan: Number(plan[c.key]) || 0, real: Number(real[c.key]) || 0 })).filter(
    (d) => d.plan !== d.real
  );
}

/** Texto curto de uma divergência de efetivo: "Refratários 3 → 5". */
export function formatDiferencas(difs) {
  return difs.map((d) => `${d.label} ${d.plan} → ${d.real}`).join(' · ');
}

/**
 * Compara o planejado do projeto com o que foi apontado em campo. Cada
 * lançamento é ligado à etapa pelo `etapaId` gravado nele. Devolve, por
 * etapa, o tempo planejado × real e a média de efetivo real, além dos
 * totais e da lista de lançamentos que divergiram (tempo ou efetivo).
 */
export function resumoProjeto(projeto, lancamentos) {
  const doProjeto = lancamentos.filter((l) => l.projetoId === projeto.id);
  const etapas = (projeto.etapas || []).map((etapa) => {
    const ls = doProjeto.filter((l) => l.tipoRegistro !== 'improdutividade' && l.etapaId === etapa.id);
    const realMin = ls.reduce((s, l) => s + (Number(l.duracaoMinutos) || 0), 0);
    const efetivoMedio = {};
    EFETIVO_CAMPOS.forEach((c) => {
      efetivoMedio[c.key] = ls.length ? Math.round((ls.reduce((s, l) => s + (Number(l.efetivo?.[c.key]) || 0), 0) / ls.length) * 10) / 10 : 0;
    });
    return {
      etapa,
      lancamentos: ls.length,
      planejadoMin: etapa.duracaoMin || 0,
      realMin,
      desvioMin: ls.length ? realMin - (etapa.duracaoMin || 0) : 0,
      efetivoMedio,
      difEfetivo: ls.length ? efetivoDiferencas(efetivoMedio, etapa.efetivo) : []
    };
  });

  const divergencias = doProjeto.filter(
    (l) => l.tipoRegistro !== 'improdutividade' && ((Number(l.excedenteMin) || 0) > 0 || efetivoDiferencas(l.efetivo, l.efetivoPadrao).length > 0)
  );
  const improdutivoMin = doProjeto.filter((l) => l.tipoRegistro === 'improdutividade').reduce((s, l) => s + (Number(l.duracaoMinutos) || 0), 0);
  const iniciadas = etapas.filter((e) => e.lancamentos > 0).length;

  return {
    etapas,
    lancamentos: doProjeto,
    divergencias,
    improdutivoMin,
    planejadoMin: etapas.reduce((s, e) => s + e.planejadoMin, 0),
    realMin: etapas.reduce((s, e) => s + e.realMin, 0),
    progresso: etapas.length ? iniciadas / etapas.length : 0,
    iniciadas
  };
}
