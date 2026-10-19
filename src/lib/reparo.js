import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { durationMinutes, EFETIVO_CAMPOS } from '../utils/format.js';
import { gravacaoLocal } from './sync.js';
import { registrarRecuperacao } from './saude.js';

/**
 * Reparo automático de dados: só corrige campos CALCULADOS, que o app
 * deveria ter gravado de um jeito e por algum motivo (versão antiga,
 * falha no meio, edição manual no console) ficaram diferentes. Nunca
 * mexe no que a pessoa digitou (datas, horários, atividade, equipe).
 */
export function encontrarInconsistencias(lancamentos) {
  const achados = [];
  lancamentos.forEach((l) => {
    if (l._sincronizado === false) return; // ainda subindo: o próprio app vai gravar certo
    const patch = {};
    const problemas = [];
    if (l.horaInicio && l.horaTermino) {
      const dur = durationMinutes(l.horaInicio, l.horaTermino);
      if (Number(l.duracaoMinutos) !== dur) {
        patch.duracaoMinutos = dur;
        problemas.push('duração diferente dos horários');
      }
      const padrao = Number(l.duracaoPadraoMin) || 0;
      const exc = l.tipoRegistro !== 'improdutividade' && padrao > 0 ? Math.max(0, dur - padrao) : 0;
      if ((Number(l.excedenteMin) || 0) !== exc && (l.excedenteMin !== undefined || exc > 0)) {
        patch.excedenteMin = exc;
        problemas.push('excedente recalculado');
      }
    }
    if (!['atividade', 'improdutividade'].includes(l.tipoRegistro)) {
      patch.tipoRegistro = l.atividadeTipo === 'improdutiva' ? 'improdutividade' : 'atividade';
      problemas.push('tipo ausente');
    }
    if (!l.efetivo || typeof l.efetivo !== 'object') {
      patch.efetivo = Object.fromEntries(EFETIVO_CAMPOS.map((c) => [c.key, 0]));
      problemas.push('efetivo ausente');
    }
    if (problemas.length) achados.push({ lancamento: l, patch, problemas });
  });
  return achados;
}

let emAndamento = false;
const jaReparados = new Set();

/**
 * Aplica os reparos (chamado pelo painel do gestor, que tem permissão de
 * editar qualquer lançamento). Cada lançamento é reparado uma vez por sessão.
 */
export async function repararDados(lancamentos) {
  if (emAndamento) return 0;
  const lista = encontrarInconsistencias(lancamentos).filter((a) => !jaReparados.has(a.lancamento.id));
  if (!lista.length) return 0;
  emAndamento = true;
  try {
    await Promise.all(lista.slice(0, 50).map((a) => {
      jaReparados.add(a.lancamento.id);
      return gravacaoLocal(updateDoc(doc(db, 'lancamentos', a.lancamento.id), a.patch), 'reparo').catch(() => {});
    }));
    const tipos = [...new Set(lista.flatMap((a) => a.problemas))].join(', ');
    registrarRecuperacao('dados-reparados', `${Math.min(lista.length, 50)} lançamento(s): ${tipos}`);
    return Math.min(lista.length, 50);
  } finally {
    emAndamento = false;
  }
}
