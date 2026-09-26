// COMPASSO: monta o calendário. O código escolhe as janelas (dados de horário),
// o Claude decide o que publicar em cada uma (estratégia).
import { pedirJSON } from '../lib/claude.js';
import { db, agente, registrar, col, agora, novoId } from '../lib/banco.js';
import { matrizPadrao, montarJanelas } from '../lib/horarios.js';
import { fuso } from '../lib/config.js';
import { contextoDaMarca } from './estilo.js';

const SISTEMA = `Você é o Compasso, estrategista de conteúdo de uma agência de redes sociais para pequenas empresas brasileiras.
Você recebe janelas de publicação já escolhidas pelos dados de horário e decide a pauta de cada uma.

O que costuma funcionar no Instagram e no Facebook hoje (use como princípio, não como número):
- Constância pesa mais que volume. Melhor poucos posts bons toda semana do que muitos de uma vez.
- Conteúdo útil (dica, passo a passo, lista) gera salvamento e compartilhamento, que ajudam o post a circular.
- Perguntas e enquetes em stories geram resposta rápida e mantêm a marca no topo da barra de stories.
- Rosto da equipe e bastidores reais aproximam e costumam gerar comentários.
- Conteúdo original, com fotos próprias, é mais bem distribuído do que repostagem.
- No Facebook, conversa nos comentários e compartilhamento pesam mais do que curtida.
- Palavras-chave na legenda ajudam o post a aparecer na busca.

Regras:
- Formatos possíveis: "feed" (uma imagem) e "story" (uma imagem vertical). Não planeje vídeo.
- Misture objetivos ao longo da semana: alcance, salvamentos, comentários, vendas, relacionamento. Evite dois posts de venda seguidos.
- Aproveite tendências do Radar e datas próximas quando fizerem sentido para a marca. Não force.
- Não repita tema recente.
- Se o post precisa de foto e nenhuma foto do acervo serve, marque precisaFoto e descreva em "pedidoFoto" exatamente que foto o cliente deve tirar, de forma simples.
- Nunca planeje oferta, preço ou promoção que o cliente não informou.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pautas'],
  properties: {
    pautas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['janela', 'tipo', 'tema', 'objetivo', 'gancho', 'precisaFoto', 'pedidoFoto', 'porque'],
        properties: {
          janela: { type: 'integer' },
          tipo: { type: 'string', enum: ['produto', 'novidade', 'bastidores', 'dica', 'pergunta', 'tendencia', 'data'] },
          tema: { type: 'string' },
          objetivo: { type: 'string', enum: ['alcance', 'salvamentos', 'comentários', 'vendas', 'relacionamento'] },
          gancho: { type: 'string' },
          precisaFoto: { type: 'boolean' },
          pedidoFoto: { type: 'string' },
          porque: { type: 'string' }
        }
      }
    }
  }
};

export async function compasso(uid, { marca, tendencias, insights, fotos }) {
  await agente(uid, 'compasso', { status: 'trabalhando', tarefa: 'Cruzando os temas com os horários do seu público', progresso: 0.3 });
  await registrar(uid, 'compasso', 'Cruzando os temas em alta com os horários em que seu público está online.');

  const ativos = (await col(uid, 'posts').where('agendadoPara', '>=', agora()).get()).docs
    .map((d) => d.data())
    .filter((p) => !['descartado', 'falhou'].includes(p.status));
  const recentes = (await col(uid, 'posts').orderBy('agendadoPara', 'desc').limit(15).get()).docs.map((d) => d.data().pauta?.tema).filter(Boolean);

  const padrao = !insights?.horarios;
  const janelas = montarJanelas({ matriz: insights?.horarios || matrizPadrao(), ritmo: marca.ritmo, ocupados: ativos, fuso: fuso(), padrao });
  if (!janelas.length) {
    await agente(uid, 'compasso', { status: 'ocioso', tarefa: 'Calendário já estava completo', progresso: 1 });
    await registrar(uid, 'compasso', 'O calendário das próximas duas semanas já estava completo.', 'feito');
    return [];
  }

  const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso(), weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const { pautas } = await pedirJSON({
    sistema: SISTEMA,
    esforco: 'high',
    schema: SCHEMA,
    conteudo: [
      contextoDaMarca(marca),
      `JANELAS (uma pauta para cada):\n${janelas.map((j, i) => `${i}. ${j.formato} em ${fmt.format(new Date(j.agendadoPara))}`).join('\n')}`,
      `TENDÊNCIAS DO RADAR:\n${tendencias?.itens?.map((t) => `- ${t.tema} (${t.formato}, ${t.sinal}): ${t.porque}`).join('\n') || 'sem pesquisa ainda'}`,
      `DATAS PRÓXIMAS:\n${tendencias?.datas?.map((d) => `- ${d.data} ${d.nome}: ${d.ideia}`).join('\n') || 'nenhuma'}`,
      `FOTOS NO ACERVO (${fotos.length}):\n${fotos.slice(0, 40).map((f) => `- ${f.descricao || 'sem descrição ainda'}${f.usos ? ` (usada ${f.usos}x)` : ''}`).join('\n') || 'nenhuma foto ainda'}`,
      `TEMAS RECENTES (não repetir):\n${recentes.join('; ') || 'nenhum'}`
    ].join('\n\n')
  });

  const lote = db.batch();
  const criados = [];
  for (const p of pautas) {
    const j = janelas[p.janela];
    if (!j || criados.some((c) => c.agendadoPara === j.agendadoPara && c.formato === j.formato)) continue;
    const id = novoId();
    const post = {
      id,
      status: 'planejado',
      formato: j.formato,
      redes: ['instagram', 'facebook'],
      agendadoPara: j.agendadoPara,
      motivoHorario: j.motivoHorario,
      pauta: { tipo: p.tipo, tema: p.tema, objetivo: p.objetivo, gancho: p.gancho, precisaFoto: p.precisaFoto, pedidoFoto: p.pedidoFoto, porque: p.porque },
      criadoEm: agora()
    };
    lote.set(col(uid, 'posts').doc(id), post);
    criados.push(post);
  }
  await lote.commit();
  const feed = criados.filter((p) => p.formato === 'feed').length;
  await agente(uid, 'compasso', { status: 'ocioso', tarefa: 'Calendário das próximas 2 semanas pronto', progresso: 1 });
  await registrar(uid, 'compasso', `Calendário pronto: ${feed} posts no feed e ${criados.length - feed} stories nas próximas duas semanas.`, 'feito');
  return criados;
}

// Encaixa um post avulso (criado a partir de uma foto) na melhor janela livre.
export async function melhorJanela(uid, { marca, insights, formato }) {
  const ocupados = (await col(uid, 'posts').where('agendadoPara', '>=', agora()).get()).docs.map((d) => d.data()).filter((p) => !['descartado', 'falhou'].includes(p.status));
  const janelas = montarJanelas({
    matriz: insights?.horarios || matrizPadrao(),
    ritmo: { feed: 7, stories: 7 },
    ocupados,
    dias: 7,
    fuso: fuso(),
    padrao: !insights?.horarios
  }).filter((j) => j.formato === formato);
  return janelas[0] || { agendadoPara: new Date(Date.now() + 24 * 3600e3).toISOString(), motivoHorario: 'próximo horário livre' };
}
