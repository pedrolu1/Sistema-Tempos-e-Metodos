// Redação e direção de arte do MODO DEMONSTRAÇÃO.
// É uma versão por regras do que Verbo e Traço fazem com o Claude no modo real,
// escrita para soar como gente: frases de tamanhos variados, nada de travessão,
// nada de jargão, sem inventar número, prêmio ou depoimento.
import { nichoDe } from './nichos.js';

export function aleatorio(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashTexto(s = '') {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const escolher = (r, lista) => lista[Math.floor(r() * lista.length) % lista.length];
const maiuscula = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const EMOJIS = {
  alimentacao: ['☕', '🥐', '🍞', '🍰'],
  moda: ['🧵', '👗', '🛍️'],
  beleza: ['✂️', '💅', '🌿'],
  saude: ['🩺', '🌿', '💙'],
  fitness: ['💪', '🏃', '🔥'],
  servicos: ['📌', '🤝', '📎'],
  pet: ['🐶', '🐱', '🐾'],
  geral: ['✨', '📌', '🙌']
};

const CTAS = {
  whatsapp: ['Chama no WhatsApp pelo link da bio.', 'Pede pelo WhatsApp, o link está na bio.', 'Manda um oi no WhatsApp que a gente responde rapidinho.'],
  visita: ['Passa aqui para ver de perto.', 'Vem conhecer, a porta está aberta.', 'Aparece por aqui essa semana.'],
  site: ['O link está na bio.', 'Tem tudo no site, link na bio.', 'Detalhes no link da bio.'],
  comentario: ['Conta aqui nos comentários.', 'Deixa sua opinião aqui embaixo.', 'Responde nos comentários, a gente lê tudo.'],
  direct: ['Chama no direct.', 'Manda uma mensagem no direct.', 'Direct aberto para dúvidas.']
};

function cta(marca, r, preferido) {
  const tipo = preferido || marca?.cta?.tipo || 'direct';
  return escolher(r, CTAS[tipo] || CTAS.direct);
}

function hashtags(marca, nicho, r) {
  const base = [...nicho.hashtags].sort(() => r() - 0.5).slice(0, 3);
  const nomeTag = '#' + (marca?.nome || '').toLowerCase().normalize('NFD').replace(/[^\w]/g, '');
  const cidade = marca?.cidade ? '#' + marca.cidade.toLowerCase().normalize('NFD').replace(/[^\w]/g, '') : null;
  return [nomeTag.length > 2 ? nomeTag : null, ...base, cidade].filter(Boolean);
}

function comEmoji(texto, marca, nicho, r) {
  const politica = marca?.voz?.emojis || 'pouco';
  if (politica === 'nunca') return texto;
  const lista = EMOJIS[nicho.id] || EMOJIS.geral;
  const paragrafos = texto.split('\n\n');
  paragrafos[0] = `${paragrafos[0]} ${escolher(r, lista)}`;
  if (politica === 'livre' && paragrafos.length > 1) {
    paragrafos[paragrafos.length - 1] = `${paragrafos[paragrafos.length - 1]} ${escolher(r, lista)}`;
  }
  return paragrafos.join('\n\n');
}

// Monta a legenda completa de um post.
export function escreverLegenda({ marca, pauta, formato, variacao = 0, pedido = '' }) {
  const nicho = nichoDe(marca?.nicho);
  const r = aleatorio(hashTexto(pauta.tema + variacao + formato));
  const leve = (marca?.voz?.tom ?? 65) >= 50;
  const coisa = pauta.coisa || escolher(r, nicho.coisas);
  const nome = marca?.nome || 'a gente';
  let corpo = '';
  let chamada = cta(marca, r);

  switch (pauta.tipo) {
    case 'bastidores':
      corpo = leve
        ? escolher(r, [
            `Antes de abrir a porta, ${nicho.lugar} já está a mil. ${maiuscula(coisa)} começa cedo e passa pela mão de quem faz isso com gosto.\n\nA gente mostra esse lado porque é aqui que mora o cuidado que você sente depois.`,
            `Ninguém vê essa parte, mas ela é a mais importante. ${maiuscula(coisa)} leva tempo, e a gente não pula etapa.\n\nFica o registro de hoje.`
          ])
        : `Cada entrega começa bem antes do primeiro atendimento. ${maiuscula(coisa)} passa por etapas cuidadosas e por mãos experientes até chegar a você.\n\nCompartilhar esse processo é a nossa forma de mostrar o que existe por trás do resultado.`;
      break;
    case 'produto':
    case 'novidade':
      corpo = leve
        ? escolher(r, [
            `${maiuscula(coisa)} chegou e já tem gente perguntando. Escolhemos com calma, testamos, e só depois trouxemos para cá.\n\nQuer ver de perto? A gente separa para você.`,
            `Olha só o que tem de novo por aqui: ${coisa}.\n\nFoi feito para o seu dia a dia, sem complicar.`
          ])
        : `Apresentamos ${coisa}. Uma escolha feita com critério, pensada para quem valoriza qualidade no dia a dia.\n\nEstamos à disposição para tirar qualquer dúvida.`;
      break;
    case 'dica': {
      const dica = pauta.dica || escolher(r, nicho.dicas);
      const itens = dica.itens.map((i, n) => `${n + 1}. ${i}`).join('\n');
      corpo = `${dica.titulo}:\n\n${itens}\n\n${leve ? 'Salva para consultar depois e manda para quem precisa ver isso.' : 'Salve este post para consultar quando precisar.'}`;
      chamada = cta(marca, r, marca?.cta?.tipo === 'whatsapp' ? 'whatsapp' : 'comentario');
      break;
    }
    case 'pergunta': {
      const p = pauta.pergunta || escolher(r, nicho.perguntas);
      corpo = leve ? `${p}\n\nQueremos saber de verdade. A resposta que aparecer mais pode virar novidade por aqui.` : `${p}\n\nSua opinião nos ajuda a decidir os próximos passos.`;
      chamada = cta(marca, r, 'comentario');
      break;
    }
    case 'tendencia':
    default:
      corpo = leve
        ? `${maiuscula(pauta.tema)}. Entramos nessa do nosso jeito, com ${coisa}.\n\nSe curtir, manda para alguém que ia gostar.`
        : `${maiuscula(pauta.tema)}. Uma forma de mostrar ${coisa} e o cuidado de ${nome} em cada detalhe.`;
  }

  if (/curt|menor|resum/i.test(pedido)) corpo = corpo.split('\n\n')[0];
  corpo = comEmoji(corpo, marca, nicho, r);

  // Story não tem legenda no Instagram nem no Facebook: o texto vai inteiro na arte.
  if (formato === 'story') {
    return { legenda: '', cta: chamada, hashtags: [] };
  }
  return { legenda: corpo, cta: chamada, hashtags: hashtags(marca, nicho, r) };
}

// Texto curto que vai em cima da arte.
function tituloDaArte(pauta, nicho, r) {
  switch (pauta.tipo) {
    case 'bastidores':
      return escolher(r, ['Antes de abrir', 'Por trás do balcão', 'Feito à mão, todo dia', 'Onde tudo começa']);
    case 'produto':
      return maiuscula(pauta.coisa || escolher(r, nicho.coisas));
    case 'novidade':
      return escolher(r, ['Chegou hoje', 'Novidade na casa', 'Acabou de sair']);
    case 'dica':
      return (pauta.dica || nicho.dicas[0]).titulo;
    case 'pergunta':
      return pauta.pergunta || escolher(r, nicho.perguntas);
    default:
      return maiuscula(pauta.tema);
  }
}

const TEMPLATES_FOTO = {
  bastidores: ['etiqueta', 'moldura'],
  produto: ['manchete', 'recorte', 'moldura'],
  novidade: ['recorte', 'manchete'],
  tendencia: ['manchete', 'recorte', 'etiqueta'],
  pergunta: ['recorte'],
  dica: ['lista']
};

export function precisaDeFoto(pauta) {
  return !['dica', 'pergunta'].includes(pauta.tipo);
}

// Direção de arte: escolhe layout, texto e cores a partir da pauta e da foto.
export function desenharArte({ marca, pauta, formato, foto, variacao = 0 }) {
  const nicho = nichoDe(marca?.nicho);
  const seed = hashTexto(pauta.tema + formato + variacao + (foto?.id || ''));
  const r = aleatorio(seed);
  let template;
  if (!foto) template = pauta.tipo === 'dica' ? 'lista' : 'aviso';
  else template = escolher(r, TEMPLATES_FOTO[pauta.tipo] || TEMPLATES_FOTO.produto);
  if (foto && pauta.tipo === 'dica') template = 'lista';

  const titulo = tituloDaArte(pauta, nicho, r);
  const dica = pauta.tipo === 'dica' ? pauta.dica || nicho.dicas[0] : null;
  const apoio =
    formato === 'story'
      ? cta(marca, r).replace(/\.$/, '')
      : pauta.tipo === 'pergunta'
        ? 'Responde nos comentários'
        : pauta.tipo === 'bastidores'
          ? ''
          : escolher(r, ['', marca?.slogan || '', '']);

  return {
    template,
    titulo,
    apoio,
    itens: dica ? dica.itens : [],
    selo: pauta.tipo === 'novidade' ? 'Novo' : pauta.tipo === 'oferta' ? 'Só esta semana' : '',
    paleta: escolher(r, ['marca', 'marca', 'clara', 'destaque']),
    zonaTexto: foto?.analise?.zonaTexto || 'base',
    focal: foto?.analise?.focal || { x: 0.5, y: 0.5 },
    seed,
    fotoId: foto?.id || null
  };
}

const TIPOS_ROTACAO = ['produto', 'dica', 'bastidores', 'tendencia', 'pergunta', 'novidade'];

// Calendário: cruza tendências, ritmo desejado e a matriz de horários do público.
export function montarPautas({ marca, tendencias, horarios, jaTem = [], dias = 14, inicio = new Date() }) {
  const nicho = nichoDe(marca?.nicho);
  const ritmo = marca?.ritmo || { feed: 4, stories: 5 };
  const r = aleatorio(hashTexto((marca?.nome || '') + inicio.toDateString()));
  const pautas = [];
  const ocupados = new Set(jaTem.map((p) => new Date(p.agendadoPara).toDateString() + p.formato));

  // força diária do público: soma da matriz por dia da semana
  const forcaDia = horarios.map((linha) => linha.reduce((a, b) => a + b, 0));
  const desloca = jaTem.length + Math.floor(r() * 5);

  for (let semana = 0; semana < Math.ceil(dias / 7); semana++) {
    const diasSemana = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + semana * 7 + i + 1);
      return d;
    });
    const rank = [...diasSemana].sort((a, b) => forcaDia[b.getDay()] - forcaDia[a.getDay()]);
    const diasFeed = rank.slice(0, ritmo.feed);
    const diasStory = rank.slice(0, Math.min(7, ritmo.stories));

    for (const [formato, lista] of [
      ['feed', diasFeed],
      ['story', diasStory]
    ]) {
      for (const dia of lista) {
        if (ocupados.has(dia.toDateString() + formato)) continue;
        const linha = horarios[dia.getDay()];
        // melhor hora entre 7h e 22h, stories evitam colidir com o feed
        let melhor = 7;
        for (let h = 7; h <= 22; h++) if (linha[h] > linha[melhor]) melhor = h;
        let h = melhor;
        if (formato === 'story') {
          let segunda = 7;
          for (let x = 7; x <= 22; x++) if (x !== melhor && linha[x] > linha[segunda]) segunda = x;
          h = segunda === melhor ? melhor - 3 : segunda;
        }
        const quando = new Date(dia);
        quando.setHours(h, formato === 'feed' ? 5 + Math.floor(r() * 4) * 5 : 30 + Math.floor(r() * 3) * 5, 0, 0);
        const idx = pautas.length;
        const tipo = TIPOS_ROTACAO[(idx + Math.floor(r() * 2)) % TIPOS_ROTACAO.length];
        const trend = tendencias?.itens?.[idx % (tendencias?.itens?.length || 1)];
        const tipoFinal = formato === 'story' && tipo === 'dica' ? 'pergunta' : tipo;
        // rodízio (e não sorteio) para não repetir a mesma pergunta ou dica na quinzena
        const n = idx + desloca;
        const coisa = nicho.coisas[n % nicho.coisas.length];
        const dica = tipoFinal === 'dica' ? nicho.dicas[n % nicho.dicas.length] : null;
        const pergunta = nicho.perguntas[n % nicho.perguntas.length];
        const tema =
          tipoFinal === 'tendencia' && trend
            ? trend.tema
            : tipoFinal === 'dica'
              ? dica.titulo
              : tipoFinal === 'pergunta'
                ? `Enquete: ${pergunta.replace(/\?$/, '').toLowerCase()}`
                : tipoFinal === 'bastidores'
                  ? `Bastidores: ${coisa}`
                  : coisa;
        const pauta = {
          tipo: tipoFinal,
          tema,
          coisa,
          dica,
          pergunta,
          pedidoFoto: nicho.pedidosFoto[n % nicho.pedidosFoto.length],
          objetivo: tipo === 'dica' ? 'salvamentos' : tipo === 'pergunta' ? 'comentários' : tipo === 'produto' || tipo === 'novidade' ? 'vendas' : 'alcance'
        };
        pautas.push({
          formato,
          agendadoPara: quando.toISOString(),
          motivoHorario: `${Math.round(linha[h] * 100)}% do pico de seguidores online nesse horário`,
          pauta
        });
      }
    }
  }
  return pautas.sort((a, b) => new Date(a.agendadoPara) - new Date(b.agendadoPara));
}
