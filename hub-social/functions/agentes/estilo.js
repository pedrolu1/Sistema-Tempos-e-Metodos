// Contexto da marca e regras de estilo compartilhadas pelos agentes.

export function contextoDaMarca(m = {}) {
  const tom = m.voz?.tom ?? 65;
  const emojis = { nunca: 'não use emoji', pouco: 'no máximo 1 emoji, só se couber naturalmente', livre: 'até 3 emojis, sem exagero' }[m.voz?.emojis || 'pouco'];
  const cta = {
    whatsapp: `chamar no WhatsApp${m.cta?.whatsapp ? ` (${m.cta.whatsapp}), link na bio` : ' pelo link da bio'}`,
    direct: 'mandar direct',
    visita: 'visitar o espaço físico',
    site: `acessar o site${m.cta?.site ? ` (${m.cta.site})` : ''}, link na bio`,
    comentario: 'comentar no post'
  }[m.cta?.tipo || 'direct'];
  return [
    `Marca: ${m.nome || 'sem nome'}${m.usuario ? ` (@${m.usuario})` : ''}`,
    `Ramo: ${m.nicho || 'não informado'}${m.cidade ? `, em ${m.cidade}` : ''}`,
    m.descricao ? `O que faz: ${m.descricao}` : null,
    m.publico ? `Público: ${m.publico}` : null,
    m.voz?.valores?.length ? `Valores: ${m.voz.valores.join(', ')}` : null,
    `Tom de voz: ${tom < 35 ? 'formal e cuidadoso' : tom < 70 ? 'próximo e natural, sem gíria forçada' : 'descontraído, leve, bem-humorado'} (${tom}/100 de formal a descontraído)`,
    `Emojis: ${emojis}`,
    m.voz?.evitar ? `Palavras que a marca nunca usa: ${m.voz.evitar}` : null,
    `Chamada para ação preferida: ${cta}`,
    `Ritmo: ${m.ritmo?.feed ?? 4} posts no feed e ${m.ritmo?.stories ?? 5} stories por semana`
  ]
    .filter(Boolean)
    .join('\n');
}

// Regras de escrita para não soar como texto de IA.
export const REGRAS_DE_ESCRITA = `
Escreva como alguém da equipe da marca escreveria no celular, em português do Brasil.
- Varie o tamanho das frases. Nunca empilhe frases curtas e picotadas em sequência.
- Nunca use travessão (— ou –). Use vírgula, ponto ou dois-pontos.
- Proibido: jargão corporativo e clichê de marketing, como alavancar, potencializar, transformador, jornada, elevar, destravar, sinergia, robusto, fluido, experiência única, imperdível, não perca, venha conferir, você sabia, descubra, no mundo de hoje, "mais do que X, é Y", listas de três adjetivos.
- A primeira linha é o gancho: concreta e específica, algo que só essa marca diria. Nada de pergunta retórica genérica.
- Sem negrito, sem markdown, sem marcadores de emoji no começo das linhas.
- Nunca invente número, preço, prazo, prêmio, depoimento, promoção ou dado. Se a informação não foi dada, escreva sem ela.
- Uma única chamada para ação, no fim, ligada ao objetivo do post. Se não couber, deixe vazia.
- Hashtags: de 3 a 6, específicas do nicho e da cidade, em minúsculas. Nada de #love, #instagood ou parecidas.`.trim();

// Regras de direção de arte.
export const REGRAS_DE_ARTE = `
As artes são montadas com FOTOS REAIS enviadas pelo cliente e tipografia. Nenhuma imagem é gerada por IA.
Para não ter cara de peça feita por IA:
- Uma ideia por peça. Texto curto na arte: título com até 7 palavras, apoio com até 8.
- Sem clichê, sem ponto de exclamação em série, sem emoji na arte.
- Prefira composição com respiro e a foto como protagonista. Texto grande só quando a peça é tipográfica (dica, pergunta).
- Não repita a mesma foto em posts próximos. Use o número de usos de cada foto.
- A paleta deve contrastar com a foto: foto escura pede "clara" ou "destaque", foto clara pede "marca" ou "escura".`.trim();

export const LAYOUTS = `
Layouts disponíveis (campo "template"):
- manchete: foto ocupando tudo e um bloco de cor com o título na área livre da foto. Bom para produto e novidade.
- moldura: foto como uma cópia impressa presa com fita sobre a cor da marca, título e bilhete manuscrito. Bom para bastidores e momentos.
- recorte: foto em cima, faixa de cor embaixo com título grande e sublinhado de marcador. Aceita selo redondo ("Novo"). Bom para produto, novidade e oferta real.
- etiqueta: foto inteira com uma etiqueta pequena de papel. O mais discreto. Bom para bastidores e fotos muito bonitas.
- lista: tipográfico com itens numerados (2 a 5), foto pequena opcional. Para dicas úteis que as pessoas salvam.
- aviso: tipográfico com título enorme e bilhete manuscrito. Para perguntas, enquetes e frases fortes. Não usa foto.
- citacao: aspas grandes e texto em destaque. SOMENTE para depoimento real fornecido pelo cliente.`.trim();
