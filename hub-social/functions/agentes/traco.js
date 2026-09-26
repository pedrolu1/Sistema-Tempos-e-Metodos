// TRAÇO: direção de arte. Olha as fotos do cliente (visão do Claude) e decide
// layout, texto da arte e paleta. Quem desenha os pixels é o motor de artes do app
// (src/render/renderizador.js), com as fontes e cores da marca.
import { pedirJSON, imagem } from '../lib/claude.js';
import { contextoDaMarca, REGRAS_DE_ARTE, LAYOUTS } from './estilo.js';

const SISTEMA_FOTO = `Você é o Traço, diretor de arte. Descreva a foto enviada por um pequeno negócio para decidir como ela pode virar post.
Seja objetivo: o que aparece, a luz, se tem gente, se parece foto de celular ou profissional. Aponte problemas reais (tremida, escura, poluída) sem exagero.
Nunca sugira editar a foto com IA ou trocar por imagem gerada.`;

const SCHEMA_FOTO = {
  type: 'object',
  additionalProperties: false,
  required: ['descricao', 'tags', 'servePara', 'qualidade', 'dica'],
  properties: {
    descricao: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    servePara: { type: 'array', items: { type: 'string', enum: ['produto', 'novidade', 'bastidores', 'dica', 'pergunta', 'tendencia', 'data'] } },
    qualidade: { type: 'string', enum: ['boa', 'ok', 'fraca'] },
    dica: { type: 'string' }
  }
};

export async function analisarFoto({ marca, foto }) {
  return pedirJSON({
    sistema: SISTEMA_FOTO,
    esforco: 'low',
    maxTokens: 4000,
    schema: SCHEMA_FOTO,
    conteudo: [
      imagem(foto.url),
      { type: 'text', text: `${contextoDaMarca(marca)}\n\nDescreva a foto em uma frase curta (até 18 palavras), dê até 6 tags, diga para que tipo de post ela serve e uma dica curta para a próxima foto (ou vazio).` }
    ]
  });
}

const SISTEMA_ARTE = `Você é o Traço, diretor de arte de uma agência de redes sociais para pequenas empresas.
${REGRAS_DE_ARTE}

${LAYOUTS}

Sobre a escolha da foto:
- Escolha pelo id uma foto do acervo que combine com a pauta. Prefira fotos com qualidade boa e pouco usadas.
- Se a pauta não precisa de foto (dica, pergunta), pode usar "lista" ou "aviso" sem foto (fotoId vazio).
- Se precisa de foto e nenhuma serve, devolva precisaFoto=true, fotoId vazio e um pedidoFoto simples e específico.`;

const SCHEMA_ARTE = {
  type: 'object',
  additionalProperties: false,
  required: ['fotoId', 'template', 'titulo', 'apoio', 'itens', 'selo', 'paleta', 'precisaFoto', 'pedidoFoto', 'motivo'],
  properties: {
    fotoId: { type: 'string' },
    template: { type: 'string', enum: ['manchete', 'moldura', 'recorte', 'etiqueta', 'lista', 'aviso', 'citacao'] },
    titulo: { type: 'string' },
    apoio: { type: 'string' },
    itens: { type: 'array', items: { type: 'string' } },
    selo: { type: 'string' },
    paleta: { type: 'string', enum: ['marca', 'clara', 'destaque', 'escura'] },
    precisaFoto: { type: 'boolean' },
    pedidoFoto: { type: 'string' },
    motivo: { type: 'string' }
  }
};

const semente = (s) => [...s].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);

export async function desenhar({ marca, post, fotos, fotoForcada, pedido = '' }) {
  const acervo = fotoForcada ? [fotoForcada] : fotos;
  const r = await pedirJSON({
    sistema: SISTEMA_ARTE,
    esforco: 'medium',
    maxTokens: 6000,
    schema: SCHEMA_ARTE,
    conteudo: [
      contextoDaMarca(marca),
      `PAUTA (${post.formato === 'story' ? 'story vertical 9:16' : 'post de feed 4:5'}):\n${JSON.stringify(post.pauta)}`,
      `ACERVO:\n${
        acervo.length
          ? acervo
              .slice(0, 40)
              .map((f) => `- id ${f.id}: ${f.descricao || 'sem descrição'}; tags ${f.tags?.join(', ') || '-'}; qualidade ${f.qualidade || '?'}; luz ${f.analise?.claridade > 0.6 ? 'clara' : f.analise?.claridade < 0.35 ? 'escura' : 'média'}; usada ${f.usos || 0}x`)
              .join('\n')
          : 'vazio'
      }`,
      fotoForcada ? `O cliente escolheu esta foto (id ${fotoForcada.id}). Use-a.` : '',
      post.design ? `ARTE ANTERIOR (refazer):\n${JSON.stringify(post.design)}` : '',
      pedido ? `PEDIDO DE AJUSTE DO CLIENTE: ${pedido}` : ''
    ]
      .filter(Boolean)
      .join('\n\n')
  });

  const foto = acervo.find((f) => f.id === r.fotoId) || (fotoForcada && !['aviso', 'citacao'].includes(r.template) ? fotoForcada : null);
  if (r.precisaFoto && !foto) return { precisaFoto: true, pedidoFoto: r.pedidoFoto || post.pauta?.pedidoFoto || 'uma foto do seu produto ou do seu espaço, com luz natural' };
  // depoimento só com texto real vindo do cliente
  const template = r.template === 'citacao' && !/depoimento/i.test(`${pedido} ${post.pauta?.tema}`) ? (foto ? 'recorte' : 'aviso') : r.template;
  return {
    precisaFoto: false,
    design: {
      template,
      titulo: r.titulo.slice(0, 90),
      apoio: r.apoio.slice(0, 80),
      itens: r.itens.slice(0, 5),
      selo: r.selo.slice(0, 20),
      paleta: r.paleta,
      zonaTexto: foto?.analise?.zonaTexto || 'base',
      focal: foto?.analise?.focal || { x: 0.5, y: 0.5 },
      seed: semente(`${post.id}${post.variacao || 0}${Date.now()}`),
      fotoId: foto?.id || null,
      motivo: r.motivo
    },
    fotoId: foto?.id || null
  };
}
