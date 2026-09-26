// DISPARO: publica no Instagram e no Facebook os posts APROVADOS pelo cliente,
// no horário agendado. Nada sai sem status "agendado", que só o app define
// depois do ok na Mesa.
import { graph, esperar, credenciais } from '../lib/meta.js';
import { agente, registrar, agora, mensagemAmigavel } from '../lib/banco.js';

async function instagram(cred, post, legenda) {
  const params = post.formato === 'story' ? { media_type: 'STORIES', image_url: post.arteUrl } : { image_url: post.arteUrl, caption: legenda };
  const conteiner = await graph(`/${cred.igId}/media`, { metodo: 'POST', params, token: cred.pageToken });
  // o Instagram processa a imagem antes de liberar a publicação
  for (let i = 0; i < 12; i++) {
    const s = await graph(`/${conteiner.id}`, { params: { fields: 'status_code' }, token: cred.pageToken });
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error('O Instagram não aceitou a imagem.');
    await esperar(2500);
  }
  const pub = await graph(`/${cred.igId}/media_publish`, { metodo: 'POST', params: { creation_id: conteiner.id }, token: cred.pageToken });
  const info = await graph(`/${pub.id}`, { params: { fields: 'permalink' }, token: cred.pageToken }).catch(() => ({}));
  return { id: pub.id, link: info.permalink || null };
}

async function facebook(cred, post, legenda) {
  if (post.formato === 'story') {
    const foto = await graph(`/${cred.pageId}/photos`, { metodo: 'POST', params: { url: post.arteUrl, published: false }, token: cred.pageToken });
    const story = await graph(`/${cred.pageId}/photo_stories`, { metodo: 'POST', params: { photo_id: foto.id }, token: cred.pageToken });
    return { id: story.post_id || foto.id, link: null };
  }
  const r = await graph(`/${cred.pageId}/photos`, { metodo: 'POST', params: { url: post.arteUrl, message: legenda, published: true }, token: cred.pageToken });
  return { id: r.post_id || r.id, link: r.post_id ? `https://www.facebook.com/${r.post_id}` : null };
}

export async function publicar(uid, docRef) {
  // trava contra publicação dupla (duas execuções pegando o mesmo post)
  const post = await docRef.firestore.runTransaction(async (t) => {
    const s = await t.get(docRef);
    const p = s.data();
    if (!p || p.status !== 'agendado' || !p.arteUrl) return null;
    t.update(docRef, { status: 'publicando', atualizadoEm: agora() });
    return p;
  });
  if (!post) return;

  await agente(uid, 'disparo', { status: 'trabalhando', tarefa: `Publicando "${post.design?.titulo || 'post'}"`, progresso: 0.5 });
  const cred = await credenciais(uid);
  const legenda = [post.legenda, post.cta, (post.hashtags || []).join(' ')].filter(Boolean).join('\n\n');
  const resultado = {};
  const erros = [];
  for (const rede of post.redes || []) {
    try {
      if (rede === 'instagram') {
        if (!cred?.igId) throw new Error('Instagram não conectado');
        resultado.instagram = await instagram(cred, post, legenda);
      }
      if (rede === 'facebook') {
        if (!cred?.pageId) throw new Error('Facebook não conectado');
        resultado.facebook = await facebook(cred, post, legenda);
      }
    } catch (e) {
      console.error(`[disparo] ${rede}`, e.meta || e);
      erros.push(`${rede === 'instagram' ? 'Instagram' : 'Facebook'}: ${mensagemAmigavel(e)}`);
    }
  }

  const ok = Object.keys(resultado).length > 0;
  await docRef.update({
    status: ok ? 'publicado' : 'falhou',
    publicadoEm: ok ? agora() : null,
    publicacoes: resultado,
    erro: erros.join(' | ') || null,
    atualizadoEm: agora()
  });
  const onde = Object.keys(resultado)
    .map((r) => (r === 'instagram' ? 'Instagram' : 'Facebook'))
    .join(' e ');
  if (ok) await registrar(uid, 'disparo', `Publicado no ${onde}.${erros.length ? ` Falhou em: ${erros.join('; ')}.` : ''}`, erros.length ? 'alerta' : 'feito', { postId: docRef.id });
  else await registrar(uid, 'disparo', `Não consegui publicar: ${erros.join('; ')}.`, 'alerta', { postId: docRef.id });
  await agente(uid, 'disparo', { status: ok ? 'ocioso' : 'erro', tarefa: ok ? `Último post publicado no ${onde}` : erros[0], progresso: 1 });
}
