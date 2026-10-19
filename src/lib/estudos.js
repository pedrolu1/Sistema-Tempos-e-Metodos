import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { reportSnapshotError } from './errors.js';
import { gravacaoLocal } from './sync.js';
import { auditar, camposAlterados } from './auditoria.js';

const COL = 'estudos';

/**
 * Estudos de tempos (cronoanálise, amostragem, takt/lead, histórico, MTM).
 * `dados` guarda o que foi coletado no assistente e `resultado` o resumo
 * calculado — assim a lista mostra o principal sem recalcular.
 */
const porData = (a, b) => (b.criadoEmLocal || 0) - (a.criadoEmLocal || 0);
const mapear = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data(), _sincronizado: !d.metadata.hasPendingWrites })).sort(porData);

/** Todos os estudos (admin/planejador). */
export function subscribeEstudos(callback) {
  return onSnapshot(collection(db, COL), { includeMetadataChanges: true }, (snap) => callback(mapear(snap)), reportSnapshotError('estudos'));
}

/** Só os estudos feitos por este usuário (app de campo). Ordena no aparelho para não exigir índice composto. */
export function subscribeMeusEstudos(uid, callback) {
  const q = query(collection(db, COL), where('criadoPorUid', '==', uid));
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) => callback(mapear(snap)), reportSnapshotError('meus estudos'));
}

/** Remove valores que o Firestore não aceita (undefined, NaN, Infinity) de forma recursiva. */
function limpar(v) {
  if (Array.isArray(v)) return v.map(limpar);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, limpar(x)]));
  }
  if (typeof v === 'number' && !Number.isFinite(v)) return 0;
  return v;
}

/** Cria o estudo e devolve o id na hora (gerado no aparelho), mesmo offline. */
export async function addEstudo({ tipo, titulo, alvo = {}, dados = {}, resultado = {}, profile }) {
  const ref = doc(collection(db, COL));
  await gravacaoLocal(setDoc(ref, {
    tipo,
    titulo: (titulo || '').trim(),
    alvo: limpar(alvo),
    dados: limpar(dados),
    resultado: limpar(resultado),
    criadoPorUid: profile.uid,
    criadoPorNome: profile.nomeCompleto || '',
    criadoEm: serverTimestamp(),
    criadoEmLocal: Date.now()
  }), 'estudo');
  return ref.id;
}

export function deleteEstudo(id, titulo = '') {
  auditar('excluiu', 'estudo', id, titulo);
  return gravacaoLocal(deleteDoc(doc(db, COL, id)), 'estudo');
}
