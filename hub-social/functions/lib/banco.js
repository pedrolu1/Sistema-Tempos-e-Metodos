import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

if (!getApps().length) initializeApp();

export const db = getFirestore();
export const storage = () => getStorage();
export const agora = () => new Date().toISOString();
export const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const ref = (uid, ...partes) => db.doc(['usuarios', uid, ...partes].join('/'));
export const col = (uid, ...partes) => db.collection(['usuarios', uid, ...partes].join('/'));

export async function lerUsuario(uid) {
  const [marca, tendencias, insights, conexoes] = await Promise.all([
    ref(uid, 'marca', 'principal').get(),
    ref(uid, 'tendencias', 'atual').get(),
    ref(uid, 'insights', 'atual').get(),
    col(uid, 'conexoes').get()
  ]);
  const c = { instagram: null, facebook: null };
  conexoes.docs.forEach((d) => (c[d.id] = d.data()));
  return { marca: marca.data() || {}, tendencias: tendencias.data() || null, insights: insights.data() || null, conexoes: c };
}

// Estado que aparece no Estúdio
export async function agente(uid, id, patch) {
  await ref(uid, 'agentes', id).set({ ...patch, atualizadoEm: agora() }, { merge: true });
}

// Diário da equipe
export async function registrar(uid, agenteId, texto, tipo = 'info', extra = {}) {
  await col(uid, 'atividade').add({ agente: agenteId, texto, tipo, criadoEm: agora(), ...extra });
}

// Marca o agente como trabalhando, roda a tarefa e devolve ao estado de espera.
export async function trabalho(uid, id, tarefa, fn) {
  await agente(uid, id, { status: 'trabalhando', tarefa, progresso: 0.1 });
  await registrar(uid, id, tarefa);
  try {
    const r = await fn();
    return r;
  } catch (e) {
    console.error(`[${id}]`, e);
    await agente(uid, id, { status: 'erro', tarefa: mensagemAmigavel(e), progresso: 0 });
    await registrar(uid, id, `Não consegui terminar: ${mensagemAmigavel(e)}`, 'alerta');
    throw e;
  }
}

export function mensagemAmigavel(e) {
  const m = String(e?.message || e);
  if (/rate|429/i.test(m)) return 'limite de uso da API atingido, tento de novo mais tarde';
  if (/OAuthException|token/i.test(m)) return 'a conexão com a Meta expirou, reconecte em Ajustes';
  if (/timeout|ETIMEDOUT|ECONNRESET/i.test(m)) return 'a resposta demorou demais';
  return m.slice(0, 180);
}
