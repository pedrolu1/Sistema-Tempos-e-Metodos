// Orquestra o trabalho da equipe para um cliente.
import { agente, registrar, col, ref, agora, lerUsuario } from '../lib/banco.js';
import { credenciais } from '../lib/meta.js';
import { radar } from './radar.js';
import { compasso, melhorJanela } from './compasso.js';
import { desenhar, analisarFoto } from './traco.js';
import { escrever } from './verbo.js';
import { lupa } from './lupa.js';

const fotosDo = async (uid) => (await col(uid, 'fotos').orderBy('criadoEm', 'desc').limit(60).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

// Traço + Verbo para um post. Devolve true se ficou pronto para a Mesa.
export async function produzirPost(uid, { marca, docRef, post, fotos, fotoForcada, pedido }) {
  await docRef.update({ status: 'criando', atualizadoEm: agora() });
  await agente(uid, 'traco', { status: 'trabalhando', tarefa: `Arte: ${post.pauta?.tema || 'post'}`, progresso: 0.5 });
  const arte = await desenhar({ marca, post, fotos, fotoForcada, pedido: /texto|legenda|curt|formal|descontra/i.test(pedido || '') ? '' : pedido });
  if (arte.precisaFoto) {
    await docRef.update({ status: 'precisa_foto', 'pauta.pedidoFoto': arte.pedidoFoto, atualizadoEm: agora() });
    await agente(uid, 'traco', { status: 'aguardando', tarefa: `Preciso de uma foto: ${arte.pedidoFoto}` });
    await registrar(uid, 'traco', `Para "${post.pauta?.tema}" preciso de uma foto: ${arte.pedidoFoto}.`, 'alerta', { postId: docRef.id });
    return false;
  }
  if (arte.fotoId && arte.fotoId !== post.fotoId) {
    const f = fotos.find((x) => x.id === arte.fotoId) || fotoForcada;
    await ref(uid, 'fotos', arte.fotoId).update({ usos: (f?.usos || 0) + 1 });
  }
  await registrar(uid, 'traco', `Arte pronta: "${arte.design.titulo}" (${post.formato === 'story' ? 'story' : 'feed'}, layout ${arte.design.template}).`, 'feito', { postId: docRef.id });

  await agente(uid, 'verbo', { status: 'trabalhando', tarefa: `Legenda: ${post.pauta?.tema || 'post'}`, progresso: 0.5 });
  const foto = fotos.find((f) => f.id === arte.fotoId) || fotoForcada || null;
  const texto = await escrever({ marca, post, design: arte.design, foto, pedido: /arte|foto|layout|cor/i.test(pedido || '') ? '' : pedido });
  // no story, a chamada vai impressa na arte
  if (post.formato === 'story' && texto.cta && !arte.design.apoio) arte.design.apoio = texto.cta;
  await registrar(uid, 'verbo', post.formato === 'story' ? `Texto do story pronto: "${texto.cta}".` : `Legenda escrita com a chamada: "${texto.cta}".`, 'feito', { postId: docRef.id });

  await docRef.update({ status: 'aguardando', design: arte.design, fotoId: arte.fotoId, ...texto, variacao: (post.variacao || 0) + (pedido ? 1 : 0), prontoEm: agora(), atualizadoEm: agora() });
  return true;
}

async function produzirSemana(uid, marca) {
  const limite = new Date(Date.now() + 7 * 864e5).toISOString();
  const fila = (await col(uid, 'posts').where('status', 'in', ['planejado', 'precisa_foto']).get()).docs
    .filter((d) => d.data().agendadoPara <= limite)
    .sort((a, b) => a.data().agendadoPara.localeCompare(b.data().agendadoPara))
    .slice(0, 8);
  if (!fila.length) return 0;
  const fotos = await fotosDo(uid);
  let prontos = 0;
  for (const d of fila) {
    try {
      if (await produzirPost(uid, { marca, docRef: d.ref, post: { id: d.id, ...d.data() }, fotos })) prontos++;
    } catch (e) {
      console.error('[produzir]', e);
      await d.ref.update({ status: 'planejado' });
    }
  }
  await agente(uid, 'traco', { status: 'ocioso', tarefa: 'Artes da semana prontas', progresso: 1 });
  await agente(uid, 'verbo', { status: 'ocioso', tarefa: 'Legendas da semana prontas', progresso: 1 });
  return prontos;
}

async function avisarMesa(uid) {
  const n = (await col(uid, 'posts').where('status', '==', 'aguardando').get()).size;
  await agente(uid, 'disparo', n ? { status: 'aguardando', tarefa: `${n} ${n === 1 ? 'post espera' : 'posts esperam'} o seu ok na Mesa` } : { status: 'ocioso', tarefa: 'Vigiando os horários agendados' });
}

export async function rodarEquipe(uid, { somente } = {}) {
  const { marca, tendencias, insights } = await lerUsuario(uid);
  const cred = await credenciais(uid);
  let t = tendencias;
  let i = insights;
  if (!somente || somente === 'lupa') i = (await lupa(uid, { marca, cred }).catch(() => null)) || insights;
  if (!somente || somente === 'radar') t = await radar(uid, { marca, cred });
  if (!somente || somente === 'compasso') await compasso(uid, { marca, tendencias: t, insights: i, fotos: await fotosDo(uid) });
  if (!somente || ['traco', 'verbo'].includes(somente)) await produzirSemana(uid, marca);
  await avisarMesa(uid);
}

export async function criarDaFoto(uid, { fotoId, formatos = ['feed'], intencao = 'produto', detalhe = '' }) {
  const { marca, insights } = await lerUsuario(uid);
  const fotoDoc = await ref(uid, 'fotos', fotoId).get();
  if (!fotoDoc.exists) return;
  const foto = { id: fotoDoc.id, ...fotoDoc.data() };
  for (const formato of formatos) {
    await agente(uid, 'compasso', { status: 'trabalhando', tarefa: 'Procurando o melhor horário livre', progresso: 0.5 });
    const j = await melhorJanela(uid, { marca, insights, formato });
    const docRef = col(uid, 'posts').doc();
    const post = {
      id: docRef.id,
      status: 'criando',
      formato,
      redes: ['instagram', 'facebook'],
      agendadoPara: j.agendadoPara,
      motivoHorario: j.motivoHorario,
      pauta: { tipo: intencao, tema: detalhe || foto.descricao || 'foto enviada pelo cliente', objetivo: intencao === 'produto' || intencao === 'novidade' ? 'vendas' : 'alcance', origem: 'foto' },
      criadoEm: agora()
    };
    await docRef.set(post);
    await registrar(uid, 'compasso', `Encaixei o ${formato === 'story' ? 'story' : 'post'} da sua foto no melhor horário livre.`, 'feito', { postId: docRef.id });
    await agente(uid, 'compasso', { status: 'ocioso', tarefa: '', progresso: 1 });
    await produzirPost(uid, { marca, docRef, post, fotos: [foto], fotoForcada: foto });
  }
  await agente(uid, 'traco', { status: 'ocioso', tarefa: 'Arte da sua foto pronta', progresso: 1 });
  await agente(uid, 'verbo', { status: 'ocioso', tarefa: '', progresso: 1 });
  await avisarMesa(uid);
}

export async function ajustar(uid, { postId, pedido }) {
  const { marca } = await lerUsuario(uid);
  const docRef = ref(uid, 'posts', postId);
  const s = await docRef.get();
  if (!s.exists) return;
  const post = { id: s.id, ...s.data() };
  await registrar(uid, /foto|arte|layout|cor/i.test(pedido) ? 'traco' : 'verbo', `Pedido recebido: "${pedido}". Refazendo.`, 'info', { postId });
  const fotos = await fotosDo(uid);
  const fotoAtual = /outra foto/i.test(pedido) ? null : fotos.find((f) => f.id === post.fotoId);
  await produzirPost(uid, { marca, docRef, post, fotos: /outra foto/i.test(pedido) ? fotos.filter((f) => f.id !== post.fotoId) : fotos, fotoForcada: fotoAtual, pedido });
  await agente(uid, 'traco', { status: 'ocioso', tarefa: 'Ajuste entregue na Mesa', progresso: 1 });
  await agente(uid, 'verbo', { status: 'ocioso', tarefa: '', progresso: 1 });
  await avisarMesa(uid);
}

// Foto nova: Traço descreve e, se algum post estava esperando foto, usa na hora.
export async function fotoNova(uid, fotoRef) {
  const { marca } = await lerUsuario(uid);
  const foto = { id: fotoRef.id, ...(await fotoRef.get()).data() };
  const analise = await analisarFoto({ marca, foto });
  await fotoRef.update({ descricao: analise.descricao, tags: analise.tags, servePara: analise.servePara, qualidade: analise.qualidade, dicaFoto: analise.dica });
  if (!foto.silencioso) await registrar(uid, 'traco', `Foto nova no acervo: ${analise.descricao}.${analise.dica ? ` Dica para a próxima: ${analise.dica}` : ''}`, 'feito');
  const pendentes = (await col(uid, 'posts').where('status', '==', 'precisa_foto').limit(3).get()).docs;
  if (pendentes.length) {
    const fotos = await fotosDo(uid);
    for (const d of pendentes) await produzirPost(uid, { marca, docRef: d.ref, post: { id: d.id, ...d.data() }, fotos }).catch((e) => console.error(e));
    await agente(uid, 'traco', { status: 'ocioso', tarefa: 'Usei suas fotos novas nos posts que estavam parados', progresso: 1 });
    await avisarMesa(uid);
  }
}
