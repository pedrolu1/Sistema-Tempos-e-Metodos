import { classificacaoBreakdown, excedenteMinutos, temDesperdicio } from './format.js';
import { efetivoDiferencas, resumoProjeto } from './planejamento.js';

/**
 * Indicadores de um conjunto de lançamentos — a mesma conta alimenta o
 * dashboard, o relatório em PowerPoint e os assistentes, para que os
 * números nunca divirjam entre uma tela e outra.
 */
export function calcularIndicadores(lancamentos) {
  const ls = lancamentos.filter((l) => Number(l.duracaoMinutos) > 0);
  const soma = (arr) => arr.reduce((s, l) => s + (Number(l.duracaoMinutos) || 0), 0);
  const produtivos = ls.filter((l) => l.tipoRegistro !== 'improdutividade');
  const improdutivos = ls.filter((l) => l.tipoRegistro === 'improdutividade');

  const lean = { VA: 0, DN: 0, DNN: 0 };
  const porDia = new Map();
  ls.forEach((l) => {
    const b = classificacaoBreakdown(l);
    lean.VA += b.VA;
    lean.DN += b.DN;
    lean.DNN += b.DNN;
    if (!porDia.has(l.data)) porDia.set(l.data, { data: l.data, prod: 0, improd: 0, VA: 0, DN: 0, DNN: 0 });
    const d = porDia.get(l.data);
    if (l.tipoRegistro === 'improdutividade') d.improd += l.duracaoMinutos;
    else d.prod += l.duracaoMinutos;
    d.VA += b.VA;
    d.DN += b.DN;
    d.DNN += b.DNN;
  });

  // aderência: dos lançamentos produtivos que tinham um planejado, quantos ficaram dentro dele
  const comPadrao = produtivos.filter((l) => Number(l.duracaoPadraoMin) > 0);
  const noPrazo = comPadrao.filter((l) => excedenteMinutos(l) === 0);
  const comEfetivoPlan = produtivos.filter((l) => l.efetivoPadrao && Object.values(l.efetivoPadrao).some((v) => Number(v) > 0));
  const efetivoDivergente = comEfetivoPlan.filter((l) => efetivoDiferencas(l.efetivo, l.efetivoPadrao).length > 0);

  const totalMin = soma(ls);
  return {
    n: ls.length,
    totalMin,
    prodMin: soma(produtivos),
    improdMin: soma(improdutivos),
    lean,
    excedenteMin: ls.reduce((s, l) => s + excedenteMinutos(l), 0),
    comDesperdicio: ls.filter(temDesperdicio).length,
    aderenciaTempo: comPadrao.length ? noPrazo.length / comPadrao.length : null,
    comPadrao: comPadrao.length,
    divergenciaEfetivo: comEfetivoPlan.length ? efetivoDivergente.length / comEfetivoPlan.length : null,
    comEfetivoPlan: comEfetivoPlan.length,
    porDia: [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data)),
    topImprodutividades: ranking(improdutivos, (l) => l.atividadeNome, (l) => l.duracaoMinutos),
    topAtividades: ranking(produtivos, (l) => l.atividadeNome, (l) => l.duracaoMinutos),
    topExcedente: ranking(produtivos, (l) => l.atividadeNome, excedenteMinutos)
  };
}

/** Soma `valor(l)` por `chave(l)` e devolve [{ label, value }] em ordem decrescente. */
export function ranking(lancamentos, chave, valor, max = 8) {
  const m = new Map();
  lancamentos.forEach((l) => {
    const k = chave(l) || '—';
    const v = Number(valor(l)) || 0;
    if (v > 0) m.set(k, (m.get(k) || 0) + v);
  });
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, max);
}

/** Planejado × real de cada projeto com apontamentos no conjunto dado. */
export function planejadoRealPorProjeto(projetos, lancamentos) {
  return projetos
    .map((p) => {
      const r = resumoProjeto(p, lancamentos);
      const iniciadas = r.etapas.filter((e) => e.lancamentos > 0);
      return {
        projeto: p,
        etapas: r.etapas.length,
        iniciadas: iniciadas.length,
        execucoes: iniciadas.reduce((s, e) => s + e.lancamentos, 0),
        planejadoMin: r.planejadoExecMin, // planejado das execuções já feitas
        realMin: r.realMin,
        desvio: r.planejadoExecMin ? (r.realMin - r.planejadoExecMin) / r.planejadoExecMin : null,
        divergencias: r.divergencias.length
      };
    })
    .filter((x) => x.iniciadas > 0);
}

export const fracao = (parte, total) => (total > 0 ? parte / total : 0);
