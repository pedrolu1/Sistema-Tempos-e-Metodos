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
import { durationMinutes, EFETIVO_CAMPOS } from '../utils/format.js';
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
  return {
    data: input.data,
    horaInicio: input.horaInicio,
    horaTermino: input.horaTermino,
    duracaoMinutos: durationMinutes(input.horaInicio, input.horaTermino),
    tipoRegistro: input.tipoRegistro,
    contrato: input.contrato || '',
    efetivo: sanitizeEfetivo(input.efetivo),
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
