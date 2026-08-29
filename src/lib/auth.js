import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp, getDoc, collection, query, where } from 'firebase/firestore';
import { auth, db } from './firebase.js';

const USERS = 'usuarios';

// O Firebase Auth só sabe autenticar por e-mail/senha — como o login aqui é
// por matrícula, cada matrícula vira um e-mail sintético interno (nunca
// mostrado na UI). Isso também garante matrícula única "de graça": o próprio
// Firebase rejeita criar duas contas com o mesmo e-mail sintético.
const MATRICULA_EMAIL_DOMAIN = 'matricula.cronos-tm.internal';

export function isMatriculaValida(matricula) {
  return /^\d{6}$/.test(String(matricula || '').trim());
}

function matriculaParaEmail(matricula) {
  return `${String(matricula).trim()}@${MATRICULA_EMAIL_DOMAIN}`;
}

export function friendlyAuthError(err) {
  const code = err?.code || '';
  const map = {
    'auth/invalid-email': 'Matrícula inválida.',
    'auth/user-disabled': 'Esta conta foi desativada.',
    'auth/user-not-found': 'Matrícula ou senha incorretos.',
    'auth/wrong-password': 'Matrícula ou senha incorretos.',
    'auth/invalid-credential': 'Matrícula ou senha incorretos.',
    'auth/email-already-in-use': 'Essa matrícula já está cadastrada.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/network-request-failed': 'Sem conexão — verifique sua internet.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.'
  };
  return map[code] || 'Não foi possível concluir. Tente novamente.';
}

export async function registerUser({ nomeCompleto, matricula, password }) {
  if (!isMatriculaValida(matricula)) {
    throw Object.assign(new Error('matricula-invalida'), { code: 'auth/invalid-email' });
  }
  const cred = await createUserWithEmailAndPassword(auth, matriculaParaEmail(matricula), password);
  await updateProfile(cred.user, { displayName: nomeCompleto.trim() });
  await setDoc(doc(db, USERS, cred.user.uid), {
    nomeCompleto: nomeCompleto.trim(),
    matricula: String(matricula).trim(),
    role: 'lider',
    status: 'pendente',
    createdAt: serverTimestamp()
  });
  return cred.user;
}

export function loginUser({ matricula, password }) {
  if (!isMatriculaValida(matricula)) {
    return Promise.reject(Object.assign(new Error('matricula-invalida'), { code: 'auth/invalid-email' }));
  }
  return signInWithEmailAndPassword(auth, matriculaParaEmail(matricula), password);
}

export function logoutUser() {
  return fbSignOut(auth);
}

export async function fetchUserProfile(uid) {
  const snap = await getDoc(doc(db, USERS, uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/**
 * Observa autenticação + perfil (role/status) em tempo real — assim, quando o
 * admin aprova um acesso, a tela do usuário pendente atualiza sozinha.
 */
export function observeSession(callback) {
  let unsubProfile = null;

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (unsubProfile) {
      unsubProfile();
      unsubProfile = null;
    }
    if (!user) {
      callback({ user: null, profile: null });
      return;
    }
    unsubProfile = onSnapshot(
      doc(db, USERS, user.uid),
      (snap) => {
        callback({ user, profile: snap.exists() ? { uid: user.uid, ...snap.data() } : null });
      },
      () => callback({ user, profile: null })
    );
  });

  return () => {
    unsubAuth();
    if (unsubProfile) unsubProfile();
  };
}

export function subscribeUsersByStatus(status, callback) {
  const q = query(collection(db, USERS), where('status', '==', status));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))));
}

export function subscribeAllUsers(callback) {
  return onSnapshot(collection(db, USERS), (snap) => callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))));
}

export function setUserStatus(uid, status) {
  return updateDoc(doc(db, USERS, uid), { status });
}

export function setUserRole(uid, role) {
  return updateDoc(doc(db, USERS, uid), { role });
}
