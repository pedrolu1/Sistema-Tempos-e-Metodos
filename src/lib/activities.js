import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase.js';
import { reportSnapshotError } from './errors.js';

const COL = 'atividades';

export function subscribeAtividades(callback) {
  const q = query(collection(db, COL), orderBy('nome', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), reportSnapshotError('atividades'));
}

export function addAtividade({ nome, tipo, criadoPor, contrato = '', codigo = '', local = '', classificacao = '' }) {
  return addDoc(collection(db, COL), {
    nome: nome.trim(),
    tipo, // 'produtiva' | 'improdutiva'
    // classificação Lean: produtiva é VA ou DN; improdutividade é DN
    // (parada necessária/inevitável) ou DNN (desperdício evitável).
    classificacao:
      tipo === 'produtiva'
        ? classificacao === 'VA' ? 'VA' : 'DN'
        : classificacao === 'DN' ? 'DN' : 'DNN',
    contrato: contrato.trim(),
    codigo: codigo.trim(),
    local: local.trim(),
    ativo: true,
    criadoPor,
    criadoEm: serverTimestamp()
  });
}

export function updateAtividade(id, data) {
  return updateDoc(doc(db, COL, id), data);
}

export function deleteAtividade(id) {
  return deleteDoc(doc(db, COL, id));
}
