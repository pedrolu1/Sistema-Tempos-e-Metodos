// Cliente mínimo da Graph API da Meta (Instagram profissional + Página do Facebook).
// Conexão via Login do Facebook para Empresas: o usuário autoriza na janela oficial,
// o Pulso nunca recebe a senha. Tokens ficam cifrados em "segredos/{uid}".
import { META_APP_ID, META_APP_SECRET, META_REDIRECT_URI, versaoGraph } from './config.js';
import { db, agora } from './banco.js';
import { cifrar, decifrar } from './cripto.js';

export const ESCOPOS = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'read_insights',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'business_management'
];

const raiz = () => `https://graph.facebook.com/${versaoGraph()}`;
export const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

export async function graph(caminho, { metodo = 'GET', params = {}, token } = {}) {
  const url = new URL(raiz() + caminho);
  const corpo = new URLSearchParams();
  const destino = metodo === 'GET' ? url.searchParams : corpo;
  for (const [k, v] of Object.entries({ ...params, access_token: token })) {
    if (v !== undefined && v !== null) destino.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  const r = await fetch(url, metodo === 'GET' ? {} : { method: metodo, body: corpo });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = new Error(j.error?.error_user_msg || j.error?.message || `Erro ${r.status} na API da Meta`);
    e.meta = j.error;
    throw e;
  }
  return j;
}

// Métrica opcional: se a Meta não devolver (conta nova, métrica descontinuada), segue sem ela.
export async function talvez(promessa) {
  try {
    return await promessa;
  } catch (e) {
    console.warn('[meta] métrica indisponível:', e.message);
    return null;
  }
}

export function urlAutorizacao(estado) {
  const u = new URL(`https://www.facebook.com/${versaoGraph()}/dialog/oauth`);
  u.searchParams.set('client_id', META_APP_ID.value());
  u.searchParams.set('redirect_uri', META_REDIRECT_URI.value());
  u.searchParams.set('state', estado);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', ESCOPOS.join(','));
  return u.toString();
}

// Troca o código do OAuth por um token de longa duração e acha a Página + Instagram.
export async function concluirConexao(uid, codigo) {
  const curto = await graph('/oauth/access_token', {
    params: { client_id: META_APP_ID.value(), client_secret: META_APP_SECRET.value(), redirect_uri: META_REDIRECT_URI.value(), code: codigo }
  });
  const longo = await graph('/oauth/access_token', {
    params: { grant_type: 'fb_exchange_token', client_id: META_APP_ID.value(), client_secret: META_APP_SECRET.value(), fb_exchange_token: curto.access_token }
  });
  const paginas = await graph('/me/accounts', {
    params: { fields: 'id,name,access_token,followers_count,picture{url},instagram_business_account{id,username,followers_count,profile_picture_url}', limit: 50 },
    token: longo.access_token
  });
  const lista = paginas.data || [];
  if (!lista.length) throw new Error('Nenhuma Página do Facebook encontrada nessa conta. O Instagram profissional precisa estar ligado a uma Página.');
  // preferimos a página que tem Instagram profissional ligado
  const pagina = lista.find((p) => p.instagram_business_account) || lista[0];
  const ig = pagina.instagram_business_account || null;

  await db.doc(`segredos/${uid}`).set({
    meta: cifrar({
      userToken: longo.access_token,
      userTokenExpira: longo.expires_in ? new Date(Date.now() + longo.expires_in * 1000).toISOString() : null,
      pageId: pagina.id,
      pageToken: pagina.access_token,
      igId: ig?.id || null
    }),
    atualizadoEm: agora()
  });

  const conexoes = db.collection(`usuarios/${uid}/conexoes`);
  await conexoes.doc('facebook').set({
    status: 'conectado',
    nome: pagina.name,
    paginaId: pagina.id,
    seguidores: pagina.followers_count ?? null,
    foto: pagina.picture?.data?.url || null,
    outrasPaginas: lista.filter((p) => p.id !== pagina.id).map((p) => ({ id: p.id, nome: p.name })),
    conectadoEm: agora()
  });
  if (ig) {
    await conexoes.doc('instagram').set({
      status: 'conectado',
      usuario: ig.username,
      nome: ig.username,
      igId: ig.id,
      seguidores: ig.followers_count ?? null,
      foto: ig.profile_picture_url || null,
      conectadoEm: agora()
    });
  } else {
    await conexoes.doc('instagram').delete().catch(() => {});
  }
  return { pagina: pagina.name, instagram: ig?.username || null };
}

export async function credenciais(uid) {
  const d = await db.doc(`segredos/${uid}`).get();
  if (!d.exists || !d.data().meta) return null;
  return decifrar(d.data().meta);
}

export async function desconectar(uid, rede) {
  const conexoes = db.collection(`usuarios/${uid}/conexoes`);
  await conexoes.doc(rede).delete();
  const resto = await conexoes.get();
  if (resto.empty) await db.doc(`segredos/${uid}`).delete();
}
