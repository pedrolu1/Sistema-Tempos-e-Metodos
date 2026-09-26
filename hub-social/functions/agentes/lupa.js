// LUPA: lê os números reais do Instagram (e da Página), monta o Painel e sugere
// o que mudar para crescer. As sugestões só usam os dados lidos, nada inventado.
import { graph, talvez } from '../lib/meta.js';
import { pedirJSON } from '../lib/claude.js';
import { agente, registrar, ref, col, agora } from '../lib/banco.js';
import { fuso } from '../lib/config.js';
import { contextoDaMarca } from './estilo.js';

const dia = (iso) => iso.slice(0, 10);
const soma = (arr) => arr.reduce((a, b) => a + (b || 0), 0);

// Série diária de uma métrica (period=day).
async function serieDiaria(cred, metrica, desde, ate) {
  const r = await talvez(graph(`/${cred.igId}/insights`, { params: { metric: metrica, period: 'day', since: desde, until: ate }, token: cred.pageToken }));
  const valores = r?.data?.[0]?.values || [];
  return Object.fromEntries(valores.map((v) => [dia(v.end_time), v.value]));
}

// Total de um período (metric_type=total_value).
async function total(cred, metrica, desde, ate) {
  const r = await talvez(graph(`/${cred.igId}/insights`, { params: { metric: metrica, period: 'day', metric_type: 'total_value', since: desde, until: ate }, token: cred.pageToken }));
  return r?.data?.[0]?.total_value?.value ?? null;
}

// Seguidores online por hora (vem por hora do dia; distribuímos pelos dias da semana
// usando o engajamento dos posts de cada dia).
function matrizDeHorarios(online, postsPorDia) {
  const horas = Array.from({ length: 24 }, (_, h) => online?.[h] ?? online?.[String(h)] ?? 0);
  const maxH = Math.max(...horas, 1);
  const pesoDia = Array.from({ length: 7 }, (_, d) => 0.85 + 0.3 * (postsPorDia[d] || 0));
  const m = pesoDia.map((p) => horas.map((v) => (v / maxH) * p));
  const max = Math.max(...m.flat(), 1);
  return m.map((l) => l.map((v) => +(v / max).toFixed(3)));
}

const SISTEMA = `Você é a Lupa, analista de uma agência de redes sociais para pequenas empresas.
Leia os números da conta e escreva de 3 a 5 sugestões práticas para o perfil crescer.
Regras: use só os números fornecidos, cite-os quando ajudar, não invente dado nem meta. Frases naturais, sem travessão, sem jargão.
Cada sugestão tem uma ação possível no app: "rodar" (pedir para um agente refazer algo: compasso para calendário, radar para pesquisa, traco para artes), "ir" (abrir uma tela: /mesa, /agenda, /acervo, /estudio) ou nenhuma.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sugestoes'],
  properties: {
    sugestoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'detalhe', 'impacto', 'acaoTipo', 'acaoAlvo', 'acaoRotulo'],
        properties: {
          titulo: { type: 'string' },
          detalhe: { type: 'string' },
          impacto: { type: 'string', enum: ['alto', 'médio', 'baixo'] },
          acaoTipo: { type: 'string', enum: ['rodar', 'ir', 'nenhuma'] },
          acaoAlvo: { type: 'string' },
          acaoRotulo: { type: 'string' }
        }
      }
    }
  }
};

export async function lerNumeros(uid, cred) {
  const agoraS = Math.floor(Date.now() / 1000);
  const d30 = agoraS - 30 * 86400;
  const d7 = agoraS - 7 * 86400;
  const d14 = agoraS - 14 * 86400;

  const perfil = await graph(`/${cred.igId}`, { params: { fields: 'followers_count,media_count,username' }, token: cred.pageToken });
  const [alcance, novos] = await Promise.all([serieDiaria(cred, 'reach', d30, agoraS), serieDiaria(cred, 'follower_count', d30, agoraS)]);
  const [int7, int14, alc7, alc14, vis7, vis14, cli7, cli14] = await Promise.all([
    total(cred, 'total_interactions', d7, agoraS),
    total(cred, 'total_interactions', d14, d7),
    total(cred, 'reach', d7, agoraS),
    total(cred, 'reach', d14, d7),
    total(cred, 'profile_views', d7, agoraS),
    total(cred, 'profile_views', d14, d7),
    total(cred, 'website_clicks', d7, agoraS),
    total(cred, 'website_clicks', d14, d7)
  ]);
  const online = await talvez(graph(`/${cred.igId}/insights`, { params: { metric: 'online_followers', period: 'lifetime' }, token: cred.pageToken }));
  const midias = await talvez(
    graph(`/${cred.igId}/media`, { params: { fields: 'id,media_type,media_product_type,timestamp,like_count,comments_count', limit: 50 }, token: cred.pageToken })
  );
  const lista = midias?.data || [];

  // série de 30 dias
  const serie = [];
  let seguidores = perfil.followers_count;
  const dias = [];
  for (let i = 29; i >= 0; i--) dias.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
  const interacoesDia = {};
  for (const m of lista) interacoesDia[dia(m.timestamp)] = (interacoesDia[dia(m.timestamp)] || 0) + (m.like_count || 0) + (m.comments_count || 0);
  const seguidoresDia = {};
  for (let i = dias.length - 1; i >= 0; i--) {
    seguidoresDia[dias[i]] = seguidores;
    seguidores -= novos[dias[i]] || 0;
  }
  for (const d of dias) serie.push({ data: d, alcance: alcance[d] ?? 0, interacoes: interacoesDia[d] ?? 0, seguidores: seguidoresDia[d] });

  const delta = (a, b) => (a != null && b ? (a - b) / b : null);
  const eng7 = int7 != null && alc7 ? int7 / alc7 : null;
  const eng14 = int14 != null && alc14 ? int14 / alc14 : null;

  // engajamento por formato (curtidas + comentários por seguidor, média dos últimos posts)
  const grupos = {};
  for (const m of lista) {
    const nome = m.media_product_type === 'STORY' ? 'Story' : m.media_product_type === 'REELS' ? 'Reels' : m.media_type === 'CAROUSEL_ALBUM' ? 'Carrossel' : 'Foto';
    (grupos[nome] ||= []).push(((m.like_count || 0) + (m.comments_count || 0)) / Math.max(1, perfil.followers_count));
  }
  const formatos = Object.entries(grupos).map(([formato, v]) => ({ formato, taxa: soma(v) / v.length, posts: v.length }));

  // peso de cada dia da semana pelo engajamento médio dos posts publicados nele
  const porDia = Array(7).fill(0);
  const contDia = Array(7).fill(0);
  for (const m of lista) {
    const d = new Date(m.timestamp).getDay();
    porDia[d] += (m.like_count || 0) + (m.comments_count || 0);
    contDia[d]++;
  }
  const medias = porDia.map((v, i) => (contDia[i] ? v / contDia[i] : 0));
  const maxMedia = Math.max(...medias, 1);

  return {
    demo: false,
    atualizadoEm: agora(),
    fuso: fuso(),
    serie,
    kpis: {
      seguidores: { valor: perfil.followers_count, delta: soma(Object.values(novos).slice(-7)), serie: serie.map((s) => s.seguidores) },
      alcance: { valor: alc7, delta: delta(alc7, alc14), serie: serie.map((s) => s.alcance) },
      engajamento: { valor: eng7, delta: eng7 != null && eng14 != null ? eng7 - eng14 : null, serie: serie.map((s) => (s.alcance ? s.interacoes / s.alcance : 0)) },
      visitas: { valor: vis7, delta: delta(vis7, vis14), serie: [] },
      cliques: { valor: cli7, delta: delta(cli7, cli14), serie: [] }
    },
    // A Meta entrega "online_followers" por hora sem dizer o dia; se vier vazio, ficamos com a curva padrão
    horarios: online?.data?.[0]?.values?.length ? matrizDeHorarios(online.data[0].values.at(-1).value, medias.map((m) => m / maxMedia)) : null,
    formatos: formatos.length ? formatos : [{ formato: 'Foto', taxa: 0, posts: 0 }]
  };
}

export async function lupa(uid, { marca, cred }) {
  await agente(uid, 'lupa', { status: 'trabalhando', tarefa: 'Lendo alcance, interações e horários da conta', progresso: 0.3 });
  await registrar(uid, 'lupa', 'Lendo os números do Instagram dos últimos 30 dias.');
  const anterior = (await ref(uid, 'insights', 'atual').get()).data();
  let numeros = anterior && !anterior.demo ? anterior : null;
  if (cred?.igId) numeros = await lerNumeros(uid, cred);
  if (!numeros) {
    await agente(uid, 'lupa', { status: 'aguardando', tarefa: 'Conecte o Instagram para eu ler os números', progresso: 0 });
    await registrar(uid, 'lupa', 'Ainda não tenho números para ler. Conecte o Instagram em Ajustes.', 'alerta');
    return null;
  }
  if (!numeros.horarios) numeros.horarios = anterior?.horarios || null;

  const posts = (await col(uid, 'posts').orderBy('agendadoPara', 'desc').limit(40).get()).docs.map((d) => d.data());
  const resumoPosts = {
    esperandoOk: posts.filter((p) => p.status === 'aguardando').length,
    faltaFoto: posts.filter((p) => p.status === 'precisa_foto').length,
    agendados: posts.filter((p) => p.status === 'agendado').length,
    publicados: posts.filter((p) => p.status === 'publicado').length
  };
  const { sugestoes } = await pedirJSON({
    sistema: SISTEMA,
    esforco: 'medium',
    maxTokens: 6000,
    schema: SCHEMA,
    conteudo: `${contextoDaMarca(marca)}\n\nNÚMEROS (últimos 30 dias):\n${JSON.stringify({ kpis: numeros.kpis, formatos: numeros.formatos })}\n\nSITUAÇÃO DA AGENDA:\n${JSON.stringify(resumoPosts)}`
  });
  const final = {
    ...numeros,
    sugestoes: sugestoes.map((s, i) => ({
      id: `s${i}`,
      titulo: s.titulo,
      detalhe: s.detalhe,
      impacto: s.impacto,
      acao: s.acaoTipo === 'nenhuma' ? null : s.acaoTipo === 'ir' ? { tipo: 'ir', para: s.acaoAlvo, rotulo: s.acaoRotulo } : { tipo: 'rodar', agente: s.acaoAlvo, rotulo: s.acaoRotulo }
    }))
  };
  await ref(uid, 'insights', 'atual').set(final);
  await agente(uid, 'lupa', { status: 'ocioso', tarefa: `${sugestoes.length} sugestões novas no Painel`, progresso: 1 });
  await registrar(uid, 'lupa', `Números atualizados e ${sugestoes.length} sugestões novas no Painel.`, 'feito');
  return final;
}
