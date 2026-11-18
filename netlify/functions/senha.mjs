import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomInt } from 'node:crypto';

/**
 * POST /api/senha — o administrador redefine a senha de outra pessoa.
 *
 * O navegador não pode trocar a senha de outra conta no Firebase; só um
 * servidor com a chave da conta de serviço (Admin SDK). Esta função:
 *   - confere quem pede (token do Firebase) e exige administrador aprovado;
 *   - nunca mexe na própria conta de quem pede nem no administrador principal;
 *   - grava a senha nova (ou gera uma provisória e a devolve);
 *   - desconecta a pessoa dos aparelhos e, se pedido, marca que ela deve
 *     criar uma senha só dela no próximo acesso.
 *
 * A chave fica na variável FIREBASE_SERVICE_ACCOUNT da Netlify (conteúdo do
 * .json gerado em Firebase → Configurações do projeto → Contas de serviço).
 */

const resposta = (status, corpo) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// sem letras e números que se confundem (l/1, o/0)
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
const senhaProvisoria = () => Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

function firebase() {
  if (getApps().length) return getApps()[0];
  const chave = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!chave) return null;
  return initializeApp({ credential: cert(JSON.parse(chave)) });
}

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { erro: 'metodo' });

  let app;
  try {
    app = firebase();
  } catch {
    return resposta(500, { erro: 'credencial-invalida' });
  }
  if (!app) return resposta(503, { erro: 'nao-configurado' });
  const auth = getAuth(app);
  const db = getFirestore(app);

  let quem;
  try {
    quem = await auth.verifyIdToken((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  } catch {
    return resposta(401, { erro: 'sessao' });
  }
  const eu = (await db.doc(`usuarios/${quem.uid}`).get()).data();
  if (!eu || eu.role !== 'admin' || eu.status !== 'aprovado') return resposta(403, { erro: 'sem-permissao' });

  let pedido;
  try {
    pedido = await req.json();
  } catch {
    return resposta(400, { erro: 'pedido' });
  }
  const uid = String(pedido?.uid || '');
  const novaSenha = String(pedido?.novaSenha || '');
  if (!uid || uid === quem.uid) return resposta(400, { erro: 'propria-conta' });
  if (novaSenha && (novaSenha.length < 6 || novaSenha.length > 64)) return resposta(400, { erro: 'senha-fraca' });

  const principal = (await db.doc('config/admin').get()).data()?.principal;
  if (uid === principal) return resposta(403, { erro: 'principal' });
  const alvo = db.doc(`usuarios/${uid}`);
  if (!(await alvo.get()).exists) return resposta(404, { erro: 'usuario' });

  const senha = novaSenha || senhaProvisoria();
  await auth.updateUser(uid, { password: senha });
  await auth.revokeRefreshTokens(uid);
  await alvo.update({
    trocarSenha: !novaSenha || pedido?.exigirTroca !== false,
    senhaRedefinidaEm: FieldValue.serverTimestamp(),
    senhaRedefinidaPor: quem.uid
  });
  return resposta(200, novaSenha ? { ok: true } : { ok: true, senha });
};

export const config = { path: '/api/senha' };
