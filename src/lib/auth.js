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

export function friendlyAuthError(err) {
  const code = err?.code || '';
  const map = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-disabled': 'Esta conta foi desativada.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Já existe uma conta com este e-mail.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/network-request-failed': 'Sem conexão — verifique sua internet.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.'
  };
  return map[code] || 'Não foi possível concluir. Tente novamente.';
}

export async function registerUser({ nomeCompleto, email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: nomeCompleto.trim() });
  await setDoc(doc(db, USERS, cred.user.uid), {
    nomeCompleto: nomeCompleto.trim(),
    email: email.trim().toLowerCase(),
    role: 'lider',
    status: 'pendente',
    createdAt: serverTimestamp()
  });
  return cred.user;
}

export function loginUser({ email, password }) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
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
