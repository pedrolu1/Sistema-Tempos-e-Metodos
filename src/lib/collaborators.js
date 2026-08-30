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

const COL = 'colaboradores';

export function subscribeColaboradores(callback) {
  const q = query(collection(db, COL), orderBy('nomeCompleto', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), reportSnapshotError('colaboradores'));
}

export function addColaborador({ nomeCompleto, matricula, criadoPor }) {
  return addDoc(collection(db, COL), {
    nomeCompleto: nomeCompleto.trim(),
    matricula: (matricula || '').trim(),
    ativo: true,
    criadoPor,
    criadoEm: serverTimestamp()
  });
}

export function updateColaborador(id, data) {
  return updateDoc(doc(db, COL, id), data);
}

export function deleteColaborador(id) {
  return deleteDoc(doc(db, COL, id));
}
