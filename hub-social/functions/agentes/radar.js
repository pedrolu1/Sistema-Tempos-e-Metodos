// RADAR: pesquisa o que está em alta no nicho.
// Fontes: pesquisa na web feita pelo Claude + posts de maior engajamento nas
// hashtags do nicho (Instagram Hashtag Search), quando o Instagram está conectado.
import { pesquisarNaWeb, pedirJSON } from '../lib/claude.js';
import { graph, talvez } from '../lib/meta.js';
import { agente, registrar, ref, agora } from '../lib/banco.js';
import { contextoDaMarca } from './estilo.js';

const SISTEMA_PESQUISA = `Você é o Radar, pesquisador de tendências de uma agência de redes sociais para pequenas e médias empresas brasileiras.
Pesquise o que está em alta AGORA (últimas 2 a 4 semanas) no Instagram e no Facebook para o nicho informado, com foco no Brasil e na cidade quando houver.
Procure: assuntos e formatos que estão rendendo no nicho, ganchos que se repetem entre perfis que crescem, datas comemorativas e sazonais das próximas 3 semanas que fazem sentido para o negócio, e hashtags realmente usadas pelos perfis do nicho.
Seja específico e prático. Diga de onde tirou cada coisa. Se não achar evidência de algo, não invente.`;

const SISTEMA_SINTESE = `Você é o Radar. Transforme as anotações de pesquisa e os dados do Instagram em uma lista curta de tendências acionáveis para a marca.
Cada tendência precisa caber no que a agência produz: posts de imagem no feed e stories de imagem, montados com fotos reais do cliente.
Se a tendência original for vídeo (reels), adapte para imagem ou story e diga isso no campo "porque".
Não invente números. "sinal" é qualitativo: forte (muitos perfis e muito engajamento), subindo (crescendo agora), estável (funciona sempre).`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['itens', 'datas', 'hashtags'],
  properties: {
    itens: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tema', 'porque', 'formato', 'sinal', 'hashtags', 'fonte'],
        properties: {
          tema: { type: 'string' },
          porque: { type: 'string' },
          formato: { type: 'string', enum: ['foto', 'story', 'carrossel', 'reels'] },
          sinal: { type: 'string', enum: ['forte', 'subindo', 'estável'] },
          hashtags: { type: 'array', items: { type: 'string' } },
          fonte: { type: 'string' }
        }
      }
    },
    datas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['data', 'nome', 'ideia'],
        properties: { data: { type: 'string' }, nome: { type: 'string' }, ideia: { type: 'string' } }
      }
    },
    hashtags: { type: 'array', items: { type: 'string' } }
  }
};

// Top posts das hashtags do nicho (limite da Meta: 30 hashtags distintas por semana por conta).
async function dadosDeHashtags(cred, hashtags) {
  if (!cred?.igId) return [];
  const saida = [];
  for (const h of hashtags.slice(0, 3)) {
    const q = h.replace(/^#/, '').toLowerCase();
    const busca = await talvez(graph('/ig_hashtag_search', { params: { user_id: cred.igId, q }, token: cred.pageToken }));
    const id = busca?.data?.[0]?.id;
    if (!id) continue;
    const top = await talvez(
      graph(`/${id}/top_media`, { params: { user_id: cred.igId, fields: 'caption,media_type,like_count,comments_count,timestamp', limit: 25 }, token: cred.pageToken })
    );
    const posts = (top?.data || []).map((p) => ({
      tipo: p.media_type,
      curtidas: p.like_count ?? null,
      comentarios: p.comments_count ?? null,
      data: p.timestamp?.slice(0, 10),
      legenda: (p.caption || '').slice(0, 220)
    }));
    saida.push({ hashtag: `#${q}`, posts });
  }
  return saida;
}

export async function radar(uid, { marca, cred }) {
  await agente(uid, 'radar', { status: 'trabalhando', tarefa: `Pesquisando o que está em alta em "${marca.nicho || 'seu ramo'}"`, progresso: 0.2 });
  await registrar(uid, 'radar', `Pesquisando na web o que está em alta em "${marca.nicho || 'seu ramo'}"${marca.cidade ? ` e em ${marca.cidade}` : ''}.`);

  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const pesquisa = await pesquisarNaWeb({
    sistema: SISTEMA_PESQUISA,
    cidade: marca.cidade,
    pergunta: `Hoje é ${hoje}.\n\n${contextoDaMarca(marca)}\n\nPesquise as tendências e sugira 3 hashtags do nicho que valem monitorar.`
  });

  await agente(uid, 'radar', { tarefa: 'Conferindo os posts que mais engajam nas hashtags do nicho', progresso: 0.6 });
  const sugeridas = [...pesquisa.texto.matchAll(/#[\p{L}\d_]+/gu)].map((m) => m[0]);
  const hashtags = [...new Set([...(marca.hashtagsMonitoradas || []), ...sugeridas])].slice(0, 3);
  const instagram = await dadosDeHashtags(cred, hashtags);
  if (instagram.length) await registrar(uid, 'radar', `Li os posts de maior engajamento em ${instagram.map((h) => h.hashtag).join(', ')}.`);

  const final = await pedirJSON({
    sistema: SISTEMA_SINTESE,
    esforco: 'medium',
    schema: SCHEMA,
    conteudo: [
      `Hoje é ${hoje}.`,
      contextoDaMarca(marca),
      `ANOTAÇÕES DA PESQUISA NA WEB:\n${pesquisa.texto}`,
      `FONTES:\n${pesquisa.fontes.map((f) => `- ${f.titulo}: ${f.url}`).join('\n') || 'nenhuma'}`,
      `POSTS DE MAIOR ENGAJAMENTO NAS HASHTAGS (Instagram):\n${instagram.length ? JSON.stringify(instagram) : 'Instagram não conectado ou sem dados.'}`,
      'Devolva de 4 a 6 tendências, as datas relevantes das próximas 3 semanas (formato AAAA-MM-DD) e as hashtags para monitorar.'
    ].join('\n\n')
  });

  const tendencias = { ...final, fontes: pesquisa.fontes, criadoEm: agora(), demo: false };
  await ref(uid, 'tendencias', 'atual').set(tendencias);
  await ref(uid, 'marca', 'principal').set({ hashtagsMonitoradas: final.hashtags.slice(0, 3) }, { merge: true });
  await agente(uid, 'radar', { status: 'ocioso', tarefa: `${final.itens.length} temas em alta encontrados`, progresso: 1 });
  const forte = final.itens.find((i) => i.sinal === 'forte') || final.itens[0];
  await registrar(uid, 'radar', `Encontrei ${final.itens.length} temas em alta.${forte ? ` O mais forte agora: ${forte.tema}.` : ''}`, 'feito');
  return tendencias;
}
