import { collection, doc, getDocs, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { auditar } from './auditoria.js';

/**
 * Backup completo em um arquivo .json baixado no computador. É a rotina de
 * segurança que funciona no plano gratuito do Firebase (exportação
 * agendada exige o plano pago). O Assistente lembra quando passa de 7 dias.
 */
const COLECOES = ['clientes', 'contratos', 'projetos', 'atividades', 'setores', 'colaboradores', 'lancamentos', 'estudos'];

/** Converte Timestamps do Firestore em milissegundos para caber em JSON. */
function serializar(v) {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (Array.isArray(v)) return v.map(serializar);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, serializar(x)]));
  return v;
}

export async function fazerBackup({ incluirUsuarios = false, profile }) {
  const nomes = incluirUsuarios ? [...COLECOES, 'usuarios'] : COLECOES;
  const colecoes = {};
  for (const nome of nomes) {
    const snap = await getDocs(collection(db, nome));
    colecoes[nome] = snap.docs.map((d) => ({ id: d.id, ...serializar(d.data()) }));
  }
  const conteudo = { app: 'REFRAMAX Tempos & Métodos', formato: 1, geradoEm: new Date().toISOString(), geradoPor: profile.nomeCompleto, colecoes };
  const blob = new Blob([JSON.stringify(conteudo)], { type: 'application/json' });
  const a = document.createElement('a');
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `reframax-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);

  const total = Object.values(colecoes).reduce((s, l) => s + l.length, 0);
  await setDoc(doc(db, 'config', 'backup'), { ultimoEm: serverTimestamp(), ultimoEmLocal: Date.now(), por: profile.nomeCompleto, registros: total });
  auditar('exportou', 'backup', '', `${total} registros`);
  return total;
}

export function subscribeUltimoBackup(callback) {
  return onSnapshot(doc(db, 'config', 'backup'), (snap) => callback(snap.exists() ? snap.data() : null), () => callback(null));
}
