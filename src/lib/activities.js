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
import { EFETIVO_CAMPOS } from '../utils/format.js';
import { reportSnapshotError } from './errors.js';

const COL = 'atividades';

/** Inteiros não-negativos para as 5 categorias fixas de efetivo padrão. */
function sanitizeEfetivo(efetivo = {}) {
  const out = {};
  EFETIVO_CAMPOS.forEach((c) => {
    out[c.key] = Math.max(0, Math.round(Number(efetivo[c.key]) || 0));
  });
  return out;
}

export function subscribeAtividades(callback) {
  const q = query(collection(db, COL), orderBy('nome', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), reportSnapshotError('atividades'));
}

export function addAtividade({ nome, tipo, criadoPor, contrato = '', codigo = '', local = '', setor = '', classificacao = '', duracaoPadraoMin = 0, efetivoPadrao = {} }) {
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
    setor: (setor || '').trim(),
    codigo: codigo.trim(),
    local: local.trim(),
    // padrões de tempo/mão de obra — base para detectar desperdício no lançamento.
    // Só se aplicam a atividades produtivas; improdutividade não tem padrão.
    duracaoPadraoMin: tipo === 'produtiva' ? Math.max(0, Math.round(Number(duracaoPadraoMin) || 0)) : 0,
    efetivoPadrao: tipo === 'produtiva' ? sanitizeEfetivo(efetivoPadrao) : sanitizeEfetivo({}),
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
