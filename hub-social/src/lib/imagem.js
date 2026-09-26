// Análise de imagem feita no navegador: foco da foto, área calma para texto e paleta.
// Roda nos dois modos. No modo real, o Traço (Claude com visão) complementa com a
// descrição da cena e sugestões de uso.

export function carregarImagem(src) {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error('Não foi possível abrir a imagem.'));
    img.src = src;
  });
}

// Reduz a foto para no máximo `max` px no maior lado e devolve um JPEG.
export async function reduzirArquivo(arquivo, max = 1800, qualidade = 0.88) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await carregarImagem(url);
    const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', qualidade));
    return { blob, largura: w, altura: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function pixels(img, largura = 64) {
  const w = largura;
  const h = Math.max(8, Math.round((w * (img.naturalHeight || img.height)) / (img.naturalWidth || img.width)));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return { dados: ctx.getImageData(0, 0, w, h).data, w, h };
}

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function hex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export function rgb(h) {
  const v = h.replace('#', '');
  const n = parseInt(v.length === 3 ? v.replace(/./g, '$&$&') : v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminancia(h) {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// k-means simples em RGB
export function paletaDe(img, { k = 5, ignorarClaros = false, ignorarTransparentes = true } = {}) {
  const { dados } = pixels(img, 72);
  const amostras = [];
  for (let i = 0; i < dados.length; i += 4) {
    const [r, g, b, a] = [dados[i], dados[i + 1], dados[i + 2], dados[i + 3]];
    if (ignorarTransparentes && a < 128) continue;
    if (ignorarClaros && r > 240 && g > 240 && b > 240) continue;
    amostras.push([r, g, b]);
  }
  if (!amostras.length) return [];
  let centros = Array.from({ length: k }, (_, i) => amostras[Math.floor(((i + 0.5) / k) * amostras.length)]);
  let grupos = [];
  for (let it = 0; it < 8; it++) {
    grupos = centros.map(() => []);
    for (const p of amostras) {
      let melhor = 0;
      let dist = Infinity;
      centros.forEach((c, j) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < dist) {
          dist = d;
          melhor = j;
        }
      });
      grupos[melhor].push(p);
    }
    centros = grupos.map((g, j) =>
      g.length ? [0, 1, 2].map((c) => g.reduce((a, p) => a + p[c], 0) / g.length) : centros[j]
    );
  }
  return centros
    .map((c, j) => ({ cor: hex(...c), peso: grupos[j].length }))
    .filter((c) => c.peso > 0)
    .sort((a, b) => b.peso - a.peso)
    .map((c) => c.cor);
}

// Onde está o assunto da foto e qual região está mais "limpa" para receber texto.
export function analisarImagem(img) {
  const { dados, w, h } = pixels(img, 64);
  const L = new Float32Array(w * h);
  let somaR = 0;
  let somaB = 0;
  for (let i = 0, p = 0; i < dados.length; i += 4, p++) {
    L[p] = lum(dados[i], dados[i + 1], dados[i + 2]);
    somaR += dados[i];
    somaB += dados[i + 2];
  }
  const E = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      E[i] = Math.abs(L[i + 1] - L[i - 1]) + Math.abs(L[i + w] - L[i - w]);
    }
  }
  // foco: centroide da energia, com leve viés para o centro
  let sx = 0;
  let sy = 0;
  let st = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x / w - 0.5;
      const dy = y / h - 0.5;
      const vies = 0.55 + 0.45 * Math.exp(-(dx * dx + dy * dy) / 0.08);
      const e = E[y * w + x] ** 2 * vies;
      sx += x * e;
      sy += y * e;
      st += e;
    }
  }
  const focal = st ? { x: +(sx / st / w).toFixed(3), y: +(sy / st / h).toFixed(3) } : { x: 0.5, y: 0.5 };

  const zonas = {
    topo: [0, 0, w, Math.round(h * 0.32)],
    base: [0, Math.round(h * 0.68), w, h],
    esquerda: [0, 0, Math.round(w * 0.38), h],
    direita: [Math.round(w * 0.62), 0, w, h]
  };
  const medidas = {};
  for (const [nome, [x0, y0, x1, y1]] of Object.entries(zonas)) {
    let se = 0;
    let sl = 0;
    let sl2 = 0;
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        se += E[i];
        sl += L[i];
        sl2 += L[i] * L[i];
        n++;
      }
    }
    const media = sl / n;
    const desvio = Math.sqrt(Math.max(0, sl2 / n - media * media));
    const temFoco = focal.x * w >= x0 && focal.x * w <= x1 && focal.y * h >= y0 && focal.y * h <= y1;
    medidas[nome] = { ruido: se / n + desvio * 0.5 + (temFoco ? 18 : 0), claridade: media / 255 };
  }
  const zonaTexto = Object.entries(medidas).sort((a, b) => a[1].ruido - b[1].ruido)[0][0];
  const mediaL = L.reduce((a, b) => a + b, 0) / L.length / 255;
  const calor = (somaR - somaB) / (w * h) / 255;

  return {
    focal,
    zonaTexto,
    claridadeZona: +medidas[zonaTexto].claridade.toFixed(3),
    claridade: +mediaL.toFixed(3),
    tom: calor > 0.06 ? 'quente' : calor < -0.04 ? 'frio' : 'neutro',
    paleta: paletaDe(img, { k: 5 }),
    proporcao: +((img.naturalWidth || img.width) / (img.naturalHeight || img.height)).toFixed(3)
  };
}

export function descreverAnalise(a) {
  const zona = { topo: 'no topo', base: 'na parte de baixo', esquerda: 'à esquerda', direita: 'à direita' }[a.zonaTexto];
  const luz = a.claridade > 0.62 ? 'clara' : a.claridade < 0.35 ? 'escura' : 'equilibrada';
  return `Luz ${luz}, tons ${a.tom === 'neutro' ? 'neutros' : a.tom === 'quente' ? 'quentes' : 'frios'} e espaço livre ${zona} para o texto.`;
}
