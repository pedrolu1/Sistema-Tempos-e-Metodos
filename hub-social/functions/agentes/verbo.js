// VERBO: legenda, chamada para ação e hashtags, no tom da marca.
import { pedirJSON } from '../lib/claude.js';
import { contextoDaMarca, REGRAS_DE_ESCRITA } from './estilo.js';

const SISTEMA = `Você é o Verbo, redator de uma agência de redes sociais para pequenas empresas brasileiras.
${REGRAS_DE_ESCRITA}

Formato da legenda do feed:
- De 300 a 900 caracteres (dicas e listas podem chegar a 1300). Parágrafos curtos separados por linha em branco.
- A chamada para ação vai no campo "cta", não repita dentro da legenda.
- "textoAlternativo" descreve a imagem para quem usa leitor de tela, em uma frase.

Stories não têm legenda no Instagram nem no Facebook: para story devolva "legenda" vazia, hashtags vazias e escreva em "cta" uma chamada curta (até 6 palavras) que vai impressa na arte.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['legenda', 'cta', 'hashtags', 'textoAlternativo'],
  properties: {
    legenda: { type: 'string' },
    cta: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
    textoAlternativo: { type: 'string' }
  }
};

// trava final: tira travessões que escaparem e normaliza hashtags
function limpar(t = '') {
  return t
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/,\s*,/g, ',')
    .trim();
}

export async function escrever({ marca, post, design, foto, pedido = '' }) {
  const r = await pedirJSON({
    sistema: SISTEMA,
    esforco: 'medium',
    maxTokens: 6000,
    schema: SCHEMA,
    conteudo: [
      contextoDaMarca(marca),
      `FORMATO: ${post.formato === 'story' ? 'story' : 'post de feed'}`,
      `PAUTA:\n${JSON.stringify(post.pauta)}`,
      `ARTE: layout ${design.template}, texto na arte "${design.titulo}"${design.apoio ? `, apoio "${design.apoio}"` : ''}${design.itens?.length ? `, itens: ${design.itens.join(' / ')}` : ''}`,
      foto ? `FOTO: ${foto.descricao || 'foto do cliente'}` : 'SEM FOTO (peça tipográfica)',
      post.legenda ? `LEGENDA ANTERIOR (refazer):\n${post.legenda}` : '',
      pedido ? `PEDIDO DE AJUSTE DO CLIENTE: ${pedido}` : ''
    ]
      .filter(Boolean)
      .join('\n\n')
  });
  const story = post.formato === 'story';
  return {
    legenda: story ? '' : limpar(r.legenda).slice(0, 2100),
    cta: limpar(r.cta).slice(0, story ? 60 : 200),
    hashtags: story ? [] : r.hashtags.slice(0, 6).map((h) => `#${h.replace(/^#/, '').replace(/\s+/g, '').toLowerCase()}`),
    textoAlternativo: limpar(r.textoAlternativo).slice(0, 300)
  };
}
