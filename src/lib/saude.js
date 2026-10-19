import { collection, doc, setDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Saúde do app: registra falhas e as recuperações automáticas.
 *
 * Código não se reescreve sozinho — o que o app faz é (1) perceber a
 * falha, (2) se recuperar quando sabe como (recarregar após atualização,
 * remontar uma tela que quebrou, recalcular um dado inconsistente) e
 * (3) deixar um registro curto na coleção "saude", que o planejador vê
 * resumido na página Sistema e no Assistente.
 */

const COL = 'saude';
const MAX_POR_SESSAO = 15;
let contexto = { uid: '', nome: '', papel: '' };
let enviadosNaSessao = 0;
const assinaturasVistas = new Set();

export const VERSAO = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export function definirContextoSaude(profile) {
  contexto = profile ? { uid: profile.uid, nome: profile.nomeCompleto || '', papel: profile.role || '' } : { uid: '', nome: '', papel: '' };
}

function assinatura(mensagem, pilha) {
  const base = `${mensagem}|${String(pilha || '').split('\n').slice(0, 2).join('|')}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0;
  return `s${(h >>> 0).toString(36)}`;
}

function enviar(evento) {
  if (!db || !contexto.uid || enviadosNaSessao >= MAX_POR_SESSAO) return;
  enviadosNaSessao++;
  // não espera o servidor: offline, o registro sobe junto com o resto depois
  setDoc(doc(collection(db, COL)), {
    ...evento,
    uid: contexto.uid,
    nome: contexto.nome,
    papel: contexto.papel,
    versao: VERSAO,
    url: location.hash.slice(0, 80),
    navegador: navigator.userAgent.slice(0, 160),
    em: serverTimestamp(),
    emLocal: Date.now()
  }).catch(() => {}); // uma falha ao registrar não pode gerar outro registro
}

/** Registra uma falha (uma vez por tipo de falha em cada sessão). */
export function registrarErro(origem, err, { recuperado = false } = {}) {
  const mensagem = String(err?.message || err || 'erro desconhecido').slice(0, 300);
  const pilha = String(err?.stack || '').slice(0, 1500);
  const ass = assinatura(mensagem, pilha);
  // eslint-disable-next-line no-console
  console.error(`[saúde] ${origem}:`, err);
  if (assinaturasVistas.has(ass)) return;
  assinaturasVistas.add(ass);
  enviar({ tipo: 'erro', origem: String(origem).slice(0, 60), mensagem, pilha, assinatura: ass, recuperado });
}

/** Registra uma recuperação automática bem-sucedida. */
export function registrarRecuperacao(acao, detalhe = '') {
  enviar({ tipo: 'recuperacao', origem: acao, mensagem: String(detalhe).slice(0, 300), assinatura: `r-${acao}`, recuperado: true });
}

const ERRO_DE_MODULO = /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError|Failed to fetch dynamically/i;

/**
 * Captura global. Caso mais comum em PWA: o app foi atualizado no servidor
 * e a aba aberta tenta carregar um pedaço que não existe mais — a solução é
 * recarregar uma vez (com trava para não entrar em ciclo).
 */
export function instalarCapturaGlobal() {
  const tratar = (err, origem) => {
    const msg = String(err?.message || err || '');
    if (ERRO_DE_MODULO.test(msg)) {
      let jaRecarregou = false;
      try {
        jaRecarregou = sessionStorage.getItem('rfx.recarga-modulo') === '1';
        sessionStorage.setItem('rfx.recarga-modulo', '1');
      } catch {
        /* sem sessionStorage: segue sem a trava */
      }
      if (!jaRecarregou) {
        registrarRecuperacao('recarregou-versao-nova', msg);
        setTimeout(() => location.reload(), 300);
        return;
      }
    }
    registrarErro(origem, err);
  };
  window.addEventListener('error', (e) => tratar(e.error || e.message, 'janela'));
  window.addEventListener('unhandledrejection', (e) => tratar(e.reason, 'promessa'));
  // a trava vale só para a primeira recarga; depois de 30 s rodando bem, é liberada
  setTimeout(() => {
    try {
      sessionStorage.removeItem('rfx.recarga-modulo');
    } catch {
      /* idem */
    }
  }, 30000);
}

/**
 * Executa a montagem de uma tela protegendo o resto do app: se der erro,
 * tenta de novo uma vez e, se insistir, devolve um aviso amigável com o
 * botão "Tentar de novo" em vez de deixar a tela em branco.
 */
export function protegerTela(nome, montar, criarAviso) {
  try {
    return montar();
  } catch (err1) {
    try {
      const r = montar();
      registrarErro(`tela:${nome}`, err1, { recuperado: true });
      return r;
    } catch (err2) {
      registrarErro(`tela:${nome}`, err2);
      return criarAviso(err2);
    }
  }
}

/**
 * "Reparar o app": limpa os caches do app instalado e recarrega a versão
 * mais nova. Os lançamentos ainda não sincronizados ficam no banco local do
 * Firestore, que NÃO é apagado aqui.
 */
export async function repararApp() {
  registrarRecuperacao('reparo-manual');
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(regs.map((r) => r.unregister()));
    const nomes = (await caches?.keys?.()) || [];
    await Promise.all(nomes.map((n) => caches.delete(n)));
  } catch {
    /* segue para recarregar mesmo assim */
  }
  location.reload();
}

/** Eventos dos últimos 30 dias (para o painel). Filtro de campo único: não exige índice. */
export function subscribeSaude(callback) {
  const q = query(collection(db, COL), where('emLocal', '>=', Date.now() - 30 * 86400000));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.emLocal - a.emLocal)), () => callback([]));
}
