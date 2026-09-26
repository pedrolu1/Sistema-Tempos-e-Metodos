import '@fontsource-variable/fraunces';
import '@fontsource/dm-serif-display/400.css';
import '@fontsource-variable/archivo';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import '@fontsource-variable/anybody/wdth.css';
import '@fontsource/caveat/700.css';

const FIGTREE = { familia: 'Figtree Variable', peso: 500 };

// Pares tipográficos que o Traço usa nas artes. A marca escolhe um no onboarding.
export const PARES = {
  editorial: {
    nome: 'Editorial',
    titulo: { familia: 'Fraunces Variable', peso: 640, espaco: -0.02 },
    texto: FIGTREE,
    pra: 'Serifa com personalidade. Café, livraria, gastronomia.'
  },
  classico: {
    nome: 'Clássico',
    titulo: { familia: 'DM Serif Display', peso: 400, espaco: -0.01 },
    texto: FIGTREE,
    pra: 'Elegante sem ser frio. Moda, beleza, advocacia.'
  },
  moderno: {
    nome: 'Moderno',
    titulo: { familia: 'Archivo Variable', peso: 800, espaco: -0.03 },
    texto: { familia: 'Archivo Variable', peso: 500 },
    pra: 'Firme e limpo. Academia, tecnologia, serviços.'
  },
  amigavel: {
    nome: 'Amigável',
    titulo: { familia: 'Bricolage Grotesque Variable', peso: 720, espaco: -0.025 },
    texto: FIGTREE,
    pra: 'Próximo e simpático. Pet, doces, comércio de bairro.'
  },
  impacto: {
    nome: 'Impacto',
    titulo: { familia: 'Anybody Variable', peso: 820, espaco: -0.02, largo: true },
    texto: FIGTREE,
    pra: 'Largo e barulhento. Eventos, streetwear, promoções.'
  }
};

export const MANUSCRITO = { familia: 'Caveat', peso: 700 };

export function parDaMarca(marca) {
  return PARES[marca?.fontes] || PARES.editorial;
}

const carregadas = new Set();

export async function carregarFontes(par) {
  const chave = par.titulo.familia + par.texto.familia;
  if (carregadas.has(chave)) return;
  await Promise.all([
    document.fonts.load(`${par.titulo.peso} 80px "${par.titulo.familia}"`),
    document.fonts.load(`${par.texto.peso} 32px "${par.texto.familia}"`),
    document.fonts.load(`700 32px "${par.texto.familia}"`),
    document.fonts.load(`700 48px "${MANUSCRITO.familia}"`)
  ]).catch(() => {});
  carregadas.add(chave);
}
