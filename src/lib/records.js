import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fsLimit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase.js';
import { durationMinutes, EFETIVO_CAMPOS, efetivoExcedido } from '../utils/format.js';
import { reportSnapshotError } from './errors.js';

const COL = 'lancamentos';

/** Garante inteiros não-negativos para as 5 categorias fixas de efetivo. */
function sanitizeEfetivo(efetivo = {}) {
  const out = {};
  EFETIVO_CAMPOS.forEach((c) => {
    out[c.key] = Math.max(0, Math.round(Number(efetivo[c.key]) || 0));
  });
  return out;
}

/**
 * Monta o payload de um lançamento. `criadoEmLocal` é um número (Date.now()),
 * não um serverTimestamp — ele existe só para permitir ordenação consistente
 * mesmo em documentos criados offline, antes do carimbo do servidor chegar.
 */
function buildPayload(input) {
  const duracaoMinutos = durationMinutes(input.horaInicio, input.horaTermino);
  const efetivo = sanitizeEfetivo(input.efetivo);
  const efetivoPadrao = sanitizeEfetivo(input.efetivoPadrao);
  const duracaoPadraoMin = input.tipoRegistro === 'improdutividade' ? 0 : Math.max(0, Math.round(Number(input.duracaoPadraoMin) || 0));
  const excedenteMin = duracaoPadraoMin > 0 ? Math.max(0, duracaoMinutos - duracaoPadraoMin) : 0;
  const efetivoExcede = efetivoExcedido(efetivo, efetivoPadrao);
  return {
    data: input.data,
    horaInicio: input.horaInicio,
    horaTermino: input.horaTermino,
    duracaoMinutos,
    tipoRegistro: input.tipoRegistro,
    contrato: input.contrato || '',
    setor: input.setor || '',
    // projeto planejado ao qual o apontamento pertence (vazio = avulso) e a
    // etapa do plano — é por ela que o painel compara planejado × real.
    projetoId: input.projetoId || '',
    projetoNome: input.projetoNome || '',
    clienteNome: input.clienteNome || '',
    etapaId: input.etapaId || '',
    efetivo,
    // padrões vigentes no momento do lançamento (snapshot) + desvios calculados,
    // base para os alertas e indicadores de desperdício. `excedenteMin` é o tempo
    // que passou do padrão (vira DN); `efetivoExcede` marca mão de obra acima do
    // padrão; `justificativa` é preenchida pelo líder quando há qualquer excesso.
    duracaoPadraoMin,
    efetivoPadrao,
    excedenteMin,
    efetivoExcede,
    justificativa: (input.justificativa || '').trim(),
    atividadeId: input.atividadeId,
    atividadeNome: input.atividadeNome,
    atividadeTipo: input.atividadeTipo,
    // classificação Lean herdada da atividade escolhida no momento do
    // lançamento: atividade é VA ou DN; improdutividade é DN (parada
    // necessária/inevitável) ou DNN (desperdício evitável) — sem valor
    // salvo, cai no padrão mais conservador de cada tipo.
    classificacao:
      input.tipoRegistro === 'improdutividade'
        ? input.classificacao === 'DN'
          ? 'DN'
          : 'DNN'
        : input.classificacao === 'VA'
          ? 'VA'
          : 'DN',
    // líder da atividade — campo legado, não é mais coletado no app mobile
    // (removido do formulário); preservado aqui só para não quebrar registros
    // antigos e permitir que o admin ainda o edite pelo painel desktop.
    liderId: input.liderId || '',
    liderNome: input.liderNome || '',
    colaboradoresIds: input.colaboradoresIds || [],
    colaboradoresNomes: input.colaboradoresNomes || [],
    observacoes: input.observacoes || ''
  };
}

export function createLancamento(input) {
  return addDoc(collection(db, COL), {
    ...buildPayload(input),
    criadoPorUid: input.criadoPorUid,
    criadoPorNome: input.criadoPorNome,
    criadoEm: serverTimestamp(),
    criadoEmLocal: Date.now(),
    atualizadoEm: serverTimestamp()
  });
}

export function updateLancamento(id, input) {
  return updateDoc(doc(db, COL, id), {
    ...buildPayload(input),
    atualizadoEm: serverTimestamp()
  });
}

export function deleteLancamento(id) {
  return deleteDoc(doc(db, COL, id));
}

function mapSnapshot(snap) {
  return snap.docs.map((d) => {
    const pending = d.metadata.hasPendingWrites;
    return {
      id: d.id,
      ...d.data(),
      _sincronizado: !pending,
      _fromCache: d.metadata.fromCache
    };
  });
}

/** Lançamentos lançados por este usuário no app mobile — inclui metadata para saber o status de sync. */
export function subscribeMeusLancamentos(uid, callback) {
  const q = query(
    collection(db, COL),
    where('criadoPorUid', '==', uid),
    orderBy('criadoEmLocal', 'desc'),
    fsLimit(300)
  );
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) => callback(mapSnapshot(snap)), reportSnapshotError('meus lançamentos'));
}

/** Todos os lançamentos (admin / dashboard). */
export function subscribeTodosLancamentos(callback, { max = 3000 } = {}) {
  const q = query(collection(db, COL), orderBy('criadoEmLocal', 'desc'), fsLimit(max));
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) => callback(mapSnapshot(snap)), reportSnapshotError('lançamentos'));
}

/**
 * Campos herdados ao editar um lançamento existente. Se a atividade não
 * mudou, preserva o "retrato" gravado no lançamento (padrões planejados,
 * etapa do projeto, classificação) — assim editar só o horário não troca o
 * planejado do projeto pelo padrão genérico do catálogo. Se a atividade
 * mudou, passa a valer o padrão da nova atividade do catálogo.
 */
export function contextoDaEdicao(l, atividadeId, atividade) {
  const mesma = atividadeId === l.atividadeId;
  return {
    contrato: l.contrato || '',
    setor: l.setor || '',
    projetoId: l.projetoId || '',
    projetoNome: l.projetoNome || '',
    clienteNome: l.clienteNome || '',
    etapaId: mesma ? l.etapaId || '' : '',
    atividadeId,
    atividadeNome: mesma ? l.atividadeNome : atividade?.nome || '',
    atividadeTipo: atividade?.tipo || l.atividadeTipo || '',
    classificacao: mesma ? l.classificacao || '' : atividade?.classificacao || '',
    duracaoPadraoMin: mesma ? l.duracaoPadraoMin || 0 : atividade?.duracaoPadraoMin || 0,
    efetivoPadrao: mesma ? l.efetivoPadrao || {} : atividade?.efetivoPadrao || {},
    justificativa: l.justificativa || ''
  };
}
