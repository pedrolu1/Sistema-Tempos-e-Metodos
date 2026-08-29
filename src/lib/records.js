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
import { durationMinutes } from '../utils/format.js';

const COL = 'lancamentos';

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
    atividadeId: input.atividadeId,
    atividadeNome: input.atividadeNome,
    atividadeTipo: input.atividadeTipo,
    // líder da atividade (pessoa da equipe responsável por ela) — um cadastro
    // do roster de colaboradores, distinto de quem operou o app (criadoPorUid).
    liderId: input.liderId,
    liderNome: input.liderNome,
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
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) => callback(mapSnapshot(snap)));
}

/** Todos os lançamentos (admin / dashboard). */
export function subscribeTodosLancamentos(callback, { max = 3000 } = {}) {
  const q = query(collection(db, COL), orderBy('criadoEmLocal', 'desc'), fsLimit(max));
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) => callback(mapSnapshot(snap)));
}
