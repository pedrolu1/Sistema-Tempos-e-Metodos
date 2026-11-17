// Login e acesso ao Primárias. A conta é a mesma do Tempos & Métodos
// (matrícula + senha); o acesso ao Primárias é separado, em prim_usuarios,
// com o papel de cada um: líder, planejador, administrador ou gestor.
// Quem é administrador do Tempos & Métodos entra direto como administrador.
// Sem Firebase configurado (desenvolvimento), entra-se escolhendo um perfil
// de demonstração.
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db, firebaseConfigured } from './firebase.js';

export const modoDemo = !firebaseConfigured;
const COL = 'prim_usuarios';
// mesmo e-mail interno do Tempos & Métodos: a matrícula é a conta
const DOMINIO = 'matricula.cronos-tm.internal';
const emailDa = (matricula) => `${String(matricula).trim()}@${DOMINIO}`;
export const matriculaValida = (m) => /^\d{6}$/.test(String(m || '').trim());

function comPrazo(promessa, ms = 20000) {
  return Promise.race([promessa, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'auth/timeout' })), ms))]);
}

export function mensagemDeErro(err) {
  const mapa = {
    'auth/invalid-email': 'Matrícula inválida: são 6 números.',
    'auth/user-disabled': 'Esta conta foi desativada.',
    'auth/user-not-found': 'Matrícula ou senha incorretos.',
    'auth/wrong-password': 'Matrícula ou senha incorretos.',
    'auth/invalid-credential': 'Matrícula ou senha incorretos.',
    'auth/email-already-in-use': 'Essa matrícula já tem conta (a mesma do Tempos & Métodos). Entre com ela.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/requires-recent-login': 'Por segurança, saia e entre de novo antes de trocar a senha.',
    'auth/network-request-failed': 'Sem conexão. Para entrar pela primeira vez neste aparelho precisa de internet.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    'auth/timeout': 'O servidor demorou para responder. Confira a internet e tente de novo.',
    'senha-atual': 'A senha atual não confere.'
  };
  return mapa[err?.code] || 'Não foi possível concluir. Tente de novo.';
}

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------

/**
 * Avisa a cada mudança: { estado, perfil, sugestao }.
 * estado: 'carregando' | 'sem-login' | 'sem-acesso' | 'pendente' | 'negado' | 'trocar-senha' | 'ok'
 */
export function observarAcesso(cb) {
  if (modoDemo) return observarDemo(cb);
  let pararDoc = null;
  const pararAuth = onAuthStateChanged(auth, (user) => {
    pararDoc?.();
    pararDoc = null;
    if (!user) return cb({ estado: 'sem-login' });
    cb({ estado: 'carregando' });
    const matricula = (user.email || '').split('@')[0];
    pararDoc = onSnapshot(doc(db, COL, user.uid), async (snap) => {
      if (!snap.exists()) {
        let tm = null;
        try {
          const d = await getDoc(doc(db, 'usuarios', user.uid));
          tm = d.exists() ? d.data() : null;
        } catch {
          /* sem acesso ao cadastro do T&M: segue como novo */
        }
        if (tm?.role === 'admin' && tm?.status === 'aprovado') {
          // administrador do Tempos & Métodos: libera a si mesmo como administrador
          await setDoc(doc(db, COL, user.uid), { nome: tm.nomeCompleto || user.displayName || '', matricula, papel: 'admin', status: 'aprovado', criadoEm: serverTimestamp() }).catch(() => cb({ estado: 'sem-acesso', sugestao: { nome: tm.nomeCompleto, matricula } }));
          return;
        }
        return cb({ estado: 'sem-acesso', sugestao: { nome: tm?.nomeCompleto || user.displayName || '', matricula } });
      }
      const d = snap.data();
      const perfil = { uid: user.uid, nome: d.nome, matricula: d.matricula, papel: d.papel };
      if (d.status === 'negado') return cb({ estado: 'negado', perfil });
      if (d.status !== 'aprovado') return cb({ estado: 'pendente', perfil });
      if (d.trocarSenha) return cb({ estado: 'trocar-senha', perfil });
      cb({ estado: 'ok', perfil });
    }, () => cb({ estado: 'sem-acesso', sugestao: { nome: user.displayName || '', matricula } }));
  });
  return () => {
    pararAuth();
    pararDoc?.();
  };
}

export function entrar(matricula, senha) {
  if (!matriculaValida(matricula)) return Promise.reject(Object.assign(new Error('matricula'), { code: 'auth/invalid-email' }));
  if (modoDemo) return Promise.resolve();
  return comPrazo(signInWithEmailAndPassword(auth, emailDa(matricula), senha));
}

/** Conta nova (quem ainda não tem conta no Tempos & Métodos). Nasce como líder pendente. */
export async function cadastrar({ nome, matricula, senha }) {
  if (!matriculaValida(matricula)) throw Object.assign(new Error('matricula'), { code: 'auth/invalid-email' });
  const cred = await comPrazo(createUserWithEmailAndPassword(auth, emailDa(matricula), senha));
  await updateProfile(cred.user, { displayName: nome.trim() });
  await setDoc(doc(db, COL, cred.user.uid), { nome: nome.trim(), matricula: String(matricula).trim(), papel: 'lider', status: 'pendente', criadoEm: serverTimestamp() });
}

/** Quem já tem conta (do Tempos & Métodos) pede acesso ao Primárias. */
export function solicitarAcesso({ nome, matricula }) {
  return setDoc(doc(db, COL, auth.currentUser.uid), { nome: nome.trim(), matricula: String(matricula).trim(), papel: 'lider', status: 'pendente', criadoEm: serverTimestamp() });
}

export function sair() {
  if (modoDemo) return sairDemo();
  return signOut(auth);
}

export async function alterarMinhaSenha(atual, nova) {
  const user = auth.currentUser;
  try {
    await comPrazo(reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, atual)));
  } catch (err) {
    if (['auth/wrong-password', 'auth/invalid-credential'].includes(err?.code)) throw Object.assign(new Error('senha-atual'), { code: 'senha-atual' });
    throw err;
  }
  await comPrazo(updatePassword(user, nova));
}

/** Depois de uma senha provisória, a pessoa cria a dela. */
export async function criarSenhaPropria(nova) {
  await comPrazo(updatePassword(auth.currentUser, nova));
  await updateDoc(doc(db, COL, auth.currentUser.uid), { trocarSenha: false });
  // a senha é a mesma do Tempos & Métodos: libera lá também
  await updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { trocarSenha: false }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Usuários (tela do administrador)
// ---------------------------------------------------------------------------
export function assinarUsuarios(cb) {
  if (modoDemo) return assinarUsuariosDemo(cb);
  return onSnapshot(collection(db, COL), (snap) => cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))), () => cb([]));
}
export function atualizarUsuario(uid, mudancas) {
  if (modoDemo) return atualizarUsuarioDemo(uid, mudancas);
  return updateDoc(doc(db, COL, uid), mudancas);
}
export function removerAcesso(uid) {
  if (modoDemo) return atualizarUsuarioDemo(uid, null);
  return deleteDoc(doc(db, COL, uid));
}

/** Redefine a senha de alguém pela função /api/senha (precisa da chave do Firebase na Netlify). */
export async function redefinirSenha(uid) {
  const token = await auth.currentUser.getIdToken();
  let r;
  try {
    r = await fetch('/api/senha', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ uid, exigirTroca: true }) });
  } catch {
    throw Object.assign(new Error('rede'), { code: 'rede' });
  }
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(corpo.erro || 'falhou'), { code: corpo.erro || (r.status === 404 ? 'nao-configurado' : 'falhou') });
  return corpo.senha || '';
}

// ---------------------------------------------------------------------------
// Modo demonstração (sem Firebase): perfis prontos, guardados no navegador
// ---------------------------------------------------------------------------
export const PERFIS_DEMO = [
  { uid: 'demo-lider-1', nome: 'Líder 1', matricula: '100001', papel: 'lider' },
  { uid: 'demo-lider-2', nome: 'Líder 2', matricula: '100002', papel: 'lider' },
  { uid: 'demo-planejador', nome: 'Planejador', matricula: '100003', papel: 'planejador' },
  { uid: 'demo-admin', nome: 'Administrador', matricula: '100004', papel: 'admin' },
  { uid: 'demo-gestor', nome: 'Gestor', matricula: '100005', papel: 'gestor' }
];
const CHAVE_DEMO = 'prim.perfil';
const CHAVE_USUARIOS = 'prim.demo.usuarios';
const ouvintesDemo = new Set();
let perfilDemo = null;
function lerDemo() {
  try {
    const uid = sessionStorage.getItem(CHAVE_DEMO) || localStorage.getItem(CHAVE_DEMO);
    return PERFIS_DEMO.find((p) => p.uid === uid) || null;
  } catch {
    return null;
  }
}
function observarDemo(cb) {
  perfilDemo = lerDemo();
  const avisar = () => cb(perfilDemo ? { estado: 'ok', perfil: perfilDemo } : { estado: 'sem-login', demo: true });
  ouvintesDemo.add(avisar);
  avisar();
  return () => ouvintesDemo.delete(avisar);
}
export function entrarDemo(uid) {
  try {
    sessionStorage.setItem(CHAVE_DEMO, uid);
    localStorage.setItem(CHAVE_DEMO, uid);
  } catch {
    /* sem armazenamento: vale só nesta página */
  }
  perfilDemo = PERFIS_DEMO.find((p) => p.uid === uid) || null;
  ouvintesDemo.forEach((f) => f());
}
function sairDemo() {
  try {
    sessionStorage.removeItem(CHAVE_DEMO);
    localStorage.removeItem(CHAVE_DEMO);
  } catch {
    /* nada a limpar */
  }
  perfilDemo = null;
  ouvintesDemo.forEach((f) => f());
}
function usuariosDemo() {
  let extras = {};
  try {
    extras = JSON.parse(localStorage.getItem(CHAVE_USUARIOS) || '{}');
  } catch {
    extras = {};
  }
  const base = [...PERFIS_DEMO.map((p) => ({ ...p, status: 'aprovado' })), { uid: 'demo-novo', nome: 'Líder Novo', matricula: '100006', papel: 'lider', status: 'pendente' }];
  return base.map((u) => (extras[u.uid] === null ? null : { ...u, ...(extras[u.uid] || {}) })).filter(Boolean);
}
const ouvintesUsuarios = new Set();
function assinarUsuariosDemo(cb) {
  ouvintesUsuarios.add(cb);
  cb(usuariosDemo());
  return () => ouvintesUsuarios.delete(cb);
}
function atualizarUsuarioDemo(uid, mudancas) {
  let extras = {};
  try {
    extras = JSON.parse(localStorage.getItem(CHAVE_USUARIOS) || '{}');
  } catch {
    extras = {};
  }
  extras[uid] = mudancas === null ? null : { ...(extras[uid] || {}), ...mudancas };
  try {
    localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(extras));
  } catch {
    /* sem armazenamento */
  }
  const lista = usuariosDemo();
  ouvintesUsuarios.forEach((f) => f(lista));
  return Promise.resolve();
}

export const autorDe = (p) => ({ uid: p.uid, nome: p.nome, papel: p.papel });
