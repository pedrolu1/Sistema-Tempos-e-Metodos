// Acesso ao Claude para todos os agentes.
// Modelo padrão: claude-opus-5 (troque com o parâmetro CLAUDE_MODEL).
// Fallback no servidor ligado: se o modelo recusar um pedido por engano, a API
// refaz com o modelo reserva recomendado, sem precisar de código extra aqui.
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, modelo } from './config.js';

let cliente = null;
const claude = () => (cliente ||= new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() }));

const BETAS = ['server-side-fallback-2026-07-01'];

function base({ sistema, esforco, maxTokens }) {
  return {
    model: modelo(),
    max_tokens: maxTokens,
    betas: BETAS,
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    // prompt de sistema fixo por agente: fica em cache entre chamadas
    system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: esforco }
  };
}

function conferirParada(r) {
  if (r.stop_reason === 'refusal') {
    throw new Error(`O modelo não aceitou este pedido${r.stop_details?.explanation ? `: ${r.stop_details.explanation}` : '.'}`);
  }
  if (r.stop_reason === 'max_tokens') throw new Error('A resposta ficou longa demais e foi cortada.');
}

const textoDe = (r) =>
  r.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

// Resposta em JSON validada pelo schema (structured outputs).
export async function pedirJSON({ sistema, conteudo, schema, esforco = 'high', maxTokens = 16000 }) {
  const params = base({ sistema, esforco, maxTokens });
  params.output_config.format = { type: 'json_schema', schema };
  const r = await claude().beta.messages.create({ ...params, messages: [{ role: 'user', content: conteudo }] });
  conferirParada(r);
  return JSON.parse(textoDe(r));
}

// Pesquisa na web (ferramenta do próprio Claude). Devolve anotações em texto + fontes.
export async function pesquisarNaWeb({ sistema, pergunta, cidade, maxBuscas = 8 }) {
  const params = base({ sistema, esforco: 'high', maxTokens: 16000 });
  params.tools = [
    {
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: maxBuscas,
      user_location: { type: 'approximate', country: 'BR', timezone: 'America/Sao_Paulo', ...(cidade ? { city: cidade } : {}) }
    }
  ];
  const mensagens = [{ role: 'user', content: pergunta }];
  const fontes = new Map();
  for (let volta = 0; volta < 5; volta++) {
    const r = await claude().beta.messages.create({ ...params, messages: mensagens });
    conferirParada(r);
    for (const b of r.content) {
      // erro da busca vem como objeto, sucesso como lista
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
        for (const item of b.content) if (item.url) fontes.set(item.url, item.title || item.url);
      }
    }
    // turnos longos de busca podem pausar: devolvemos o turno e deixamos continuar
    if (r.stop_reason === 'pause_turn') {
      mensagens.push({ role: 'assistant', content: r.content });
      continue;
    }
    return { texto: textoDe(r), fontes: [...fontes].slice(0, 12).map(([url, titulo]) => ({ url, titulo })) };
  }
  throw new Error('A pesquisa na web não terminou a tempo.');
}

export function imagem(url) {
  return { type: 'image', source: { type: 'url', url } };
}
