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
import { escalaInfo } from '../utils/format.js';
import { reportSnapshotError } from './errors.js';

const COL = 'setores';

export function subscribeSetores(callback) {
  const q = query(collection(db, COL), orderBy('nome', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), reportSnapshotError('setores'));
}

export function addSetor({ nome, escala = 'adm', horasPorTurno, turmas = 1, criadoPor }) {
  const info = escalaInfo(escala);
  return addDoc(collection(db, COL), {
    nome: nome.trim(),
    escala,
    horasPorTurno: Math.max(1, Math.round(Number(horasPorTurno) || info.horasPadrao)),
    turmas: Math.max(1, Math.round(Number(turmas) || 1)),
    ativo: true,
    criadoPor,
    criadoEm: serverTimestamp()
  });
}

export function updateSetor(id, data) {
  return updateDoc(doc(db, COL, id), data);
}

export function deleteSetor(id) {
  return deleteDoc(doc(db, COL, id));
}
