import { collection, doc, setDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Registro de auditoria: quem alterou ou excluiu o quê, e quando. Só
 * acrescenta (as regras do Firestore proíbem editar ou apagar um registro).
 * Lançamentos novos não entram aqui — cada lançamento já guarda quem o criou.
 */

const COL = 'auditoria';
let usuario = null;

export function definirUsuarioAuditoria(profile) {
  usuario = profile ? { uid: profile.uid, nome: profile.nomeCompleto || '', papel: profile.role || '' } : null;
}

/** Registra uma ação. Nunca bloqueia nem quebra a ação principal. */
export function auditar(acao, entidade, entidadeId, resumo = '') {
  if (!db || !usuario) return;
  setDoc(doc(collection(db, COL)), {
    acao, // 'criou' | 'alterou' | 'excluiu' | 'importou' | 'exportou'
    entidade,
    entidadeId: String(entidadeId || ''),
    resumo: String(resumo).slice(0, 300),
    uid: usuario.uid,
    nome: usuario.nome,
    papel: usuario.papel,
    em: serverTimestamp(),
    emLocal: Date.now()
  }).catch(() => {});
}

export function subscribeAuditoria(callback, max = 300) {
  const q = query(collection(db, COL), orderBy('emLocal', 'desc'), limit(max));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => callback([]));
}

/** Nomes dos campos alterados, para o resumo da auditoria. */
export function camposAlterados(data = {}) {
  return Object.keys(data).filter((k) => k !== 'atualizadoEm').join(', ');
}
