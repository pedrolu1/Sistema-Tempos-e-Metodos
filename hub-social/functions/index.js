// Cloud Functions do Pulso.
// O app grava pedidos em usuarios/{uid}/execucoes e a equipe trabalha aqui.
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { REGIAO, SEGREDOS_IA, TOKEN_KEY, META_APP_SECRET } from './lib/config.js';
import { db, ref, agora, agente, registrar, lerUsuario } from './lib/banco.js';
import { assinarEstado, lerEstado } from './lib/cripto.js';
import { urlAutorizacao, concluirConexao, desconectar, credenciais } from './lib/meta.js';
import { rodarEquipe, criarDaFoto, ajustar, fotoNova } from './agentes/orquestra.js';
import { publicar } from './agentes/disparo.js';
import { lupa } from './agentes/lupa.js';

setGlobalOptions({ region: REGIAO, maxInstances: 10 });

// ---------- pedidos da equipe ----------
export const processarExecucao = onDocumentCreated(
  { document: 'usuarios/{uid}/execucoes/{id}', timeoutSeconds: 540, memory: '512MiB', secrets: SEGREDOS_IA, retry: false },
  async (evento) => {
    const { uid } = evento.params;
    const pedido = evento.data?.data();
    if (!pedido) return;
    const docRef = evento.data.ref;
    // evita rodadas completas em sequência (clique duplo, abas abertas)
    if (pedido.tipo === 'equipe') {
      const trava = ref(uid, 'controle', 'equipe');
      const pode = await db.runTransaction(async (t) => {
        const s = await t.get(trava);
        if (s.exists && s.data().ate > Date.now()) return false;
        t.set(trava, { ate: Date.now() + 8 * 60 * 1000 });
        return true;
      });
      if (!pode) {
        await docRef.update({ status: 'ignorado', motivo: 'equipe já estava trabalhando' });
        return;
      }
    }
    await docRef.update({ status: 'rodando', inicio: agora() });
    try {
      if (pedido.tipo === 'equipe') await rodarEquipe(uid, { somente: pedido.somente });
      else if (pedido.tipo === 'foto') await criarDaFoto(uid, pedido);
      else if (pedido.tipo === 'ajuste') await ajustar(uid, pedido);
      await docRef.update({ status: 'feito', fim: agora() });
    } catch (e) {
      console.error('[execucao]', e);
      await docRef.update({ status: 'erro', erro: String(e.message || e), fim: agora() });
    } finally {
      if (pedido.tipo === 'equipe') await ref(uid, 'controle', 'equipe').delete().catch(() => {});
    }
  }
);

export const aoCriarFoto = onDocumentCreated(
  { document: 'usuarios/{uid}/fotos/{fid}', timeoutSeconds: 300, secrets: SEGREDOS_IA, retry: false },
  async (evento) => {
    if (!evento.data) return;
    await fotoNova(evento.params.uid, evento.data.ref).catch((e) => console.error('[foto]', e));
  }
);

// ---------- Disparo: a cada 5 minutos publica o que foi aprovado e chegou a hora ----------
export const disparo = onSchedule({ schedule: 'every 5 minutes', timeoutSeconds: 300, secrets: [TOKEN_KEY, META_APP_SECRET] }, async () => {
  const vencidos = await db.collectionGroup('posts').where('status', '==', 'agendado').where('agendadoPara', '<=', agora()).limit(50).get();
  for (const d of vencidos.docs) {
    const uid = d.ref.parent.parent.id;
    await publicar(uid, d.ref).catch((e) => console.error('[disparo]', uid, e));
  }
});

export const publicarAgora = onCall({ secrets: [TOKEN_KEY, META_APP_SECRET], timeoutSeconds: 120 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const docRef = ref(req.auth.uid, 'posts', String(req.data?.postId || ''));
  const s = await docRef.get();
  if (!s.exists) throw new HttpsError('not-found', 'Post não encontrado.');
  if (s.data().status !== 'agendado') throw new HttpsError('failed-precondition', 'Só dá para publicar agora um post já aprovado.');
  await publicar(req.auth.uid, docRef);
  return { ok: true };
});

// ---------- Lupa: leitura diária dos números ----------
export const lupaDiaria = onSchedule({ schedule: 'every day 07:10', timeZone: 'America/Sao_Paulo', timeoutSeconds: 540, secrets: SEGREDOS_IA }, async () => {
  const contas = await db.collection('segredos').get();
  for (const c of contas.docs) {
    const uid = c.id;
    try {
      const { marca } = await lerUsuario(uid);
      await lupa(uid, { marca, cred: await credenciais(uid) });
    } catch (e) {
      console.error('[lupa]', uid, e);
      await agente(uid, 'lupa', { status: 'erro', tarefa: 'Não consegui ler os números hoje' }).catch(() => {});
    }
  }
});

// ---------- Conexão com a Meta ----------
export const metaUrlAutorizacao = onCall({ secrets: [TOKEN_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const origem = String(req.data?.origem || '');
  const estado = assinarEstado({ uid: req.auth.uid, exp: Date.now() + 15 * 60 * 1000, origem, n: Math.random().toString(36).slice(2) });
  return { url: urlAutorizacao(estado) };
});

function paginaRetorno(ok, texto, origem) {
  const alvo = JSON.stringify(origem || '*');
  const dados = JSON.stringify({ tipo: 'pulso-meta', ok, erro: ok ? null : texto });
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pulso</title><body style="font-family:system-ui;background:#1c1644;color:#f4f0ff;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center">
<div><h1 style="font-size:22px">${ok ? 'Conectado' : 'Não deu certo'}</h1><p>${texto}</p><p style="opacity:.7">Pode fechar esta janela.</p></div>
<script>try{window.opener&&window.opener.postMessage(${dados},${alvo})}catch(e){}setTimeout(function(){window.close()},1200)</script></body></html>`;
}

export const metaRetorno = onRequest({ secrets: [TOKEN_KEY, META_APP_SECRET] }, async (req, res) => {
  let origem = '';
  try {
    if (req.query.error) throw new Error(req.query.error_description || 'Você cancelou a autorização.');
    const estado = lerEstado(req.query.state);
    origem = estado.origem;
    const r = await concluirConexao(estado.uid, String(req.query.code || ''));
    await registrar(estado.uid, 'disparo', `Conectado à Página ${r.pagina}${r.instagram ? ` e ao Instagram @${r.instagram}` : ''}. Pronto para publicar quando você aprovar.`, 'feito');
    res.status(200).send(paginaRetorno(true, r.instagram ? `Página ${r.pagina} e Instagram @${r.instagram} conectados.` : `Página ${r.pagina} conectada. Nenhum Instagram profissional ligado a ela.`, origem));
  } catch (e) {
    console.error('[metaRetorno]', e);
    res.status(400).send(paginaRetorno(false, String(e.message || e).replace(/[<>]/g, ''), origem));
  }
});

export const desconectarMeta = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const rede = req.data?.rede;
  if (!['instagram', 'facebook'].includes(rede)) throw new HttpsError('invalid-argument', 'Rede inválida.');
  await desconectar(req.auth.uid, rede);
  return { ok: true };
});
