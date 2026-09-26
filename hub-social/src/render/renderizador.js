// Motor de artes do Traço.
// Desenha posts de feed (1080x1350) e stories (1080x1920) em <canvas> a partir de:
//   spec  -> decisões do diretor de arte (layout, texto, paleta, foco, zona de texto)
//   marca -> cores, par de fontes, nome, @ e logo
//   foto  -> a foto REAL enviada pelo cliente (nenhuma imagem é gerada por IA)
// O acabamento imita peça feita à mão: grão de impressão, leve rotação, fita adesiva,
// sublinhado de marcador e bilhete manuscrito. Tudo com semente, então o mesmo post
// sempre sai igual e dois posts nunca saem idênticos.
import { parDaMarca, carregarFontes, MANUSCRITO } from './fontes.js';
import { contraste, luminancia, rgb } from '../lib/imagem.js';
import { aleatorio } from '../lib/demo/redacao.js';

export const FORMATOS = {
  feed: { w: 1080, h: 1350, topo: 72, base: 72 },
  story: { w: 1080, h: 1920, topo: 250, base: 400 }
};

export const TEMPLATES = {
  manchete: 'Manchete',
  moldura: 'Moldura',
  recorte: 'Recorte',
  etiqueta: 'Etiqueta',
  lista: 'Lista',
  aviso: 'Aviso',
  citacao: 'Citação'
};

const PADRAO_CORES = { primaria: '#23395b', secundaria: '#f2e9e4', destaque: '#f28f3b', clara: '#fbf8f3', escura: '#1d1a24' };

export function coresDaMarca(marca) {
  return { ...PADRAO_CORES, ...(marca?.cores || {}) };
}

function melhorTexto(fundo, opcoes) {
  return [...opcoes].sort((a, b) => contraste(b, fundo) - contraste(a, fundo))[0];
}

function paleta(marca, modo) {
  const c = coresDaMarca(marca);
  const fundo = { marca: c.primaria, clara: c.clara, destaque: c.destaque, escura: c.escura }[modo] || c.primaria;
  const texto = melhorTexto(fundo, [c.clara, c.escura, c.primaria, '#ffffff', '#141414']);
  let acento = [c.destaque, c.secundaria, c.primaria, texto].find((x) => x !== fundo && contraste(x, fundo) > 1.9) || texto;
  return { fundo, texto, acento, clara: c.clara, escura: c.escura };
}

function alpha(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------- utilitários de desenho ----------

function cobrir(ctx, img, x, y, w, h, focal = { x: 0.5, y: 0.5 }) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const escala = Math.max(w / iw, h / ih);
  const sw = w / escala;
  const sh = h / escala;
  const sx = Math.min(Math.max(focal.x * iw - sw / 2, 0), iw - sw);
  const sy = Math.min(Math.max(focal.y * ih - sh / 2, 0), ih - sh);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function fonte(ctx, f, tam) {
  ctx.font = `${f.peso} ${tam}px "${f.familia}"`;
  ctx.letterSpacing = f.espaco ? `${(f.espaco * tam).toFixed(1)}px` : '0px';
  if ('fontStretch' in ctx) ctx.fontStretch = f.largo ? 'expanded' : 'normal';
}

function quebrar(ctx, texto, largura) {
  const linhas = [];
  for (const paragrafo of String(texto || '').split('\n')) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean);
    let linha = '';
    for (const p of palavras) {
      const teste = linha ? `${linha} ${p}` : p;
      if (ctx.measureText(teste).width <= largura || !linha) linha = teste;
      else {
        linhas.push(linha);
        linha = p;
      }
    }
    if (linha) linhas.push(linha);
  }
  return linhas;
}

// Maior tamanho de fonte que cabe na caixa.
function caber(ctx, texto, f, { largura, altura, max, min = 24, entrelinha = 1.05, maxLinhas = 5 }) {
  for (let tam = max; tam >= min; tam -= 2) {
    fonte(ctx, f, tam);
    const linhas = quebrar(ctx, texto, largura);
    const larguraOk = linhas.every((l) => ctx.measureText(l).width <= largura);
    if (larguraOk && linhas.length <= maxLinhas && linhas.length * tam * entrelinha <= altura) return { tam, linhas };
  }
  fonte(ctx, f, min);
  return { tam: min, linhas: quebrar(ctx, texto, largura) };
}

function escrever(ctx, linhas, x, y, tam, entrelinha, alinhamento = 'left') {
  ctx.textAlign = alinhamento;
  ctx.textBaseline = 'alphabetic';
  linhas.forEach((l, i) => ctx.fillText(l, x, y + tam * 0.86 + i * tam * entrelinha));
  return y + linhas.length * tam * entrelinha;
}

let ruido = null;
function grao(ctx, w, h, forca = 0.1) {
  if (!ruido) {
    ruido = document.createElement('canvas');
    ruido.width = ruido.height = 220;
    const c = ruido.getContext('2d');
    const d = c.createImageData(220, 220);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    c.putImageData(d, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = forca;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(ruido, 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function fita(ctx, x, y, w, h, angulo, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angulo);
  ctx.fillStyle = 'rgba(247, 240, 222, 0.78)';
  ctx.beginPath();
  // bordas serrilhadas, como fita rasgada
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2, -h / 2);
  for (let i = 0; i <= 6; i++) ctx.lineTo(w / 2 + (i % 2 ? 5 : 0) + r() * 3, -h / 2 + (h * i) / 6);
  ctx.lineTo(-w / 2, h / 2);
  for (let i = 6; i >= 0; i--) ctx.lineTo(-w / 2 - (i % 2 ? 5 : 0) - r() * 3, -h / 2 + (h * i) / 6);
  ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.restore();
}

function marcador(ctx, x0, x1, y, espessura, cor, r) {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.globalAlpha = 0.92;
  ctx.lineWidth = espessura;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y + (r() - 0.5) * 6);
  const n = 3;
  for (let i = 1; i <= n; i++) {
    const cx = x0 + ((x1 - x0) * (i - 0.5)) / n;
    const ex = x0 + ((x1 - x0) * i) / n;
    ctx.quadraticCurveTo(cx, y + (r() - 0.5) * 12, ex, y + (r() - 0.5) * 7);
  }
  ctx.stroke();
  ctx.restore();
}

function selo(ctx, texto, cx, cy, raio, angulo, fundo, cor, par) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angulo);
  ctx.fillStyle = fundo;
  ctx.beginPath();
  // borda ondulada de etiqueta
  const dentes = 22;
  for (let i = 0; i <= dentes * 2; i++) {
    const a = (Math.PI * i) / dentes;
    const rr = i % 2 ? raio : raio * 0.93;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.fill();
  ctx.fillStyle = cor;
  const { tam, linhas } = caber(ctx, texto, { ...par.texto, peso: 750 }, { largura: raio * 1.4, altura: raio * 1.1, max: raio * 0.46, min: 18, entrelinha: 1.02, maxLinhas: 3 });
  escrever(ctx, linhas, 0, -(linhas.length * tam * 1.02) / 2, tam, 1.02, 'center');
  ctx.restore();
}

function assinatura(ctx, marca, x, y, cor, alinhamento, logo, tamanho = 30) {
  ctx.save();
  if (logo) {
    const h = tamanho * 2;
    const w = (h * (logo.naturalWidth || logo.width)) / (logo.naturalHeight || logo.height);
    ctx.drawImage(logo, alinhamento === 'right' ? x - w : x, y - h * 0.8, w, h);
  } else {
    fonte(ctx, { familia: 'Figtree Variable', peso: 650 }, tamanho);
    ctx.fillStyle = cor;
    ctx.textAlign = alinhamento;
    ctx.fillText(marca?.usuario ? `@${marca.usuario}` : marca?.nome || '', x, y);
  }
  ctx.restore();
}

function retangulo(ctx, x, y, w, h, raio = 0) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, raio);
}

// ---------- templates ----------

function tManchete(ctx, F, { spec, marca, foto, logo, par, cores, r }) {
  const { w, h } = F;
  if (foto) cobrir(ctx, foto, 0, 0, w, h, spec.focal);
  else {
    ctx.fillStyle = cores.fundo;
    ctx.fillRect(0, 0, w, h);
  }
  grao(ctx, w, h, 0.09);
  const m = 64;
  const lateral = spec.zonaTexto === 'esquerda' || spec.zonaTexto === 'direita';
  const bw = lateral ? w * 0.62 : w - m * 2 - 40;
  const pad = 46;
  const { tam, linhas } = caber(ctx, spec.titulo, par.titulo, { largura: bw - pad * 2, altura: F === FORMATOS.story ? 520 : 420, max: 118, min: 48, entrelinha: 1.02, maxLinhas: 4 });
  let apoio = null;
  if (spec.apoio) {
    fonte(ctx, par.texto, 34);
    apoio = quebrar(ctx, spec.apoio, bw - pad * 2).slice(0, 2);
  }
  const bh = pad * 2 + linhas.length * tam * 1.02 + (apoio ? 18 + apoio.length * 44 : 0);
  let bx = spec.zonaTexto === 'direita' ? w - m - bw : m;
  let by = spec.zonaTexto === 'topo' ? F.topo + 20 : spec.zonaTexto === 'base' || lateral ? h - F.base - bh - 40 : h - F.base - bh;
  if (lateral) by = Math.max(F.topo + 20, h * 0.5 - bh / 2 + (spec.zonaTexto === 'direita' ? 60 : -60));
  const ang = (r() - 0.5) * 0.035;
  ctx.save();
  ctx.translate(bx + bw / 2, by + bh / 2);
  ctx.rotate(ang);
  // sombra dura deslocada, como impressão fora de registro
  ctx.fillStyle = cores.acento;
  ctx.fillRect(-bw / 2 + 14, -bh / 2 + 14, bw, bh);
  ctx.fillStyle = cores.fundo;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = cores.texto;
  fonte(ctx, par.titulo, tam);
  let y = escrever(ctx, linhas, -bw / 2 + pad, -bh / 2 + pad, tam, 1.02);
  if (apoio) {
    fonte(ctx, par.texto, 34);
    ctx.globalAlpha = 0.86;
    escrever(ctx, apoio, -bw / 2 + pad, y + 18, 34, 1.3);
  }
  ctx.restore();
  const sy = spec.zonaTexto === 'topo' ? h - F.base : F.topo + 10;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 14;
  assinatura(ctx, marca, w - m, sy, '#ffffff', 'right', logo);
  ctx.restore();
}

function tMoldura(ctx, F, { spec, marca, foto, logo, par, cores, r }) {
  const { w, h } = F;
  const story = F === FORMATOS.story;
  ctx.fillStyle = cores.fundo;
  ctx.fillRect(0, 0, w, h);
  grao(ctx, w, h, 0.14);
  const borda = 24;
  const pw = story ? 860 : 780;
  const ph = story ? 1000 : 700;
  const px = (w - pw) / 2 + (r() - 0.5) * 30;
  const py = story ? F.topo + 250 : 96;
  const ang = (r() - 0.5) * 0.06;
  // título
  ctx.fillStyle = cores.texto;
  const caixaTitulo = story ? { y: F.topo, alt: 230 } : { y: py + ph + borda * 2 + 60, alt: h - (py + ph + borda * 2 + 60) - F.base - 40 };
  const { tam, linhas } = caber(ctx, spec.titulo, par.titulo, { largura: w - 160, altura: caixaTitulo.alt, max: story ? 104 : 92, min: 40, entrelinha: 1.04, maxLinhas: 3 });
  fonte(ctx, par.titulo, tam);
  escrever(ctx, linhas, 80, caixaTitulo.y, tam, 1.04);
  // foto impressa
  ctx.save();
  ctx.translate(px + pw / 2, py + ph / 2);
  ctx.rotate(ang);
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(-pw / 2 - borda, -ph / 2 - borda, pw + borda * 2, ph + borda * 2);
  ctx.shadowColor = 'transparent';
  if (foto) cobrir(ctx, foto, -pw / 2, -ph / 2, pw, ph, spec.focal);
  else {
    ctx.fillStyle = cores.acento;
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
  }
  ctx.restore();
  fita(ctx, px + 40, py - 6, 170, 46, -0.5 + r() * 0.2, r);
  fita(ctx, px + pw - 30, py + ph + 10, 170, 46, -0.6 + r() * 0.2, r);
  // bilhete manuscrito
  const nota = spec.apoio || marca?.nome || '';
  if (nota) {
    ctx.save();
    ctx.translate(story ? 110 : 90, story ? h - F.base - 20 : h - F.base + 8);
    ctx.rotate(-0.04);
    fonte(ctx, MANUSCRITO, story ? 64 : 52);
    ctx.fillStyle = cores.acento;
    ctx.fillText(nota, 0, 0);
    ctx.restore();
  }
  assinatura(ctx, marca, w - 80, story ? h - F.base - 24 : h - F.base + 8, alpha(cores.texto, 0.8), 'right', logo, 28);
}

function tRecorte(ctx, F, { spec, marca, foto, logo, par, cores, r }) {
  const { w, h } = F;
  const story = F === FORMATOS.story;
  const corte = Math.round(h * (story ? 0.56 : 0.6));
  if (foto) cobrir(ctx, foto, 0, 0, w, corte, spec.focal);
  ctx.fillStyle = cores.fundo;
  ctx.fillRect(0, corte, w, h - corte);
  grao(ctx, w, h, 0.1);
  const m = 80;
  const alturaTexto = h - corte - F.base - 90;
  ctx.fillStyle = cores.texto;
  const { tam, linhas } = caber(ctx, spec.titulo, par.titulo, { largura: w - m * 2 - (spec.selo ? 120 : 0), altura: alturaTexto * (spec.apoio ? 0.72 : 1), max: 116, min: 44, entrelinha: 1.03, maxLinhas: 4 });
  fonte(ctx, par.titulo, tam);
  let y = escrever(ctx, linhas, m, corte + 70, tam, 1.03);
  const ultima = linhas[linhas.length - 1] || '';
  const larguraUltima = ctx.measureText(ultima).width;
  marcador(ctx, m, m + Math.min(larguraUltima, w - m * 2), y + 10, Math.max(8, tam * 0.1), cores.acento, r);
  if (spec.apoio) {
    fonte(ctx, par.texto, 36);
    ctx.globalAlpha = 0.85;
    escrever(ctx, quebrar(ctx, spec.apoio, w - m * 2).slice(0, 2), m, y + 44, 36, 1.3);
    ctx.globalAlpha = 1;
  }
  if (spec.selo) selo(ctx, spec.selo, w - 170, corte, 118, -0.2 + r() * 0.2, cores.acento, melhorTexto(cores.acento, [cores.clara, cores.escura]), par);
  assinatura(ctx, marca, w - m, h - F.base + (story ? -10 : 20), alpha(cores.texto, 0.75), 'right', logo, 28);
}

function tEtiqueta(ctx, F, { spec, marca, foto, logo, par, cores, r }) {
  const { w, h } = F;
  if (foto) cobrir(ctx, foto, 0, 0, w, h, spec.focal);
  else {
    ctx.fillStyle = cores.fundo;
    ctx.fillRect(0, 0, w, h);
  }
  grao(ctx, w, h, 0.08);
  const fundo = cores.clara;
  const cor = melhorTexto(fundo, [cores.escura, cores.fundo, '#151515']);
  const f = { ...par.texto, peso: 760 };
  const { tam, linhas } = caber(ctx, spec.titulo, f, { largura: 560, altura: 200, max: 58, min: 34, entrelinha: 1.1, maxLinhas: 3 });
  fonte(ctx, f, tam);
  const larg = Math.max(...linhas.map((l) => ctx.measureText(l).width)) + 72;
  const alt = linhas.length * tam * 1.1 + 56;
  const zona = spec.zonaTexto;
  const x = zona === 'direita' ? w - larg - 90 : 90;
  const y = zona === 'topo' ? F.topo + 60 : zona === 'base' ? h - F.base - alt - 60 : zona === 'esquerda' || zona === 'direita' ? h * 0.44 : h - F.base - alt - 60;
  ctx.save();
  ctx.translate(x + larg / 2, y + alt / 2);
  ctx.rotate((r() - 0.5) * 0.08);
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = fundo;
  retangulo(ctx, -larg / 2, -alt / 2, larg, alt, 6);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = cor;
  escrever(ctx, linhas, -larg / 2 + 36, -alt / 2 + 28, tam, 1.1);
  ctx.restore();
  fita(ctx, x + larg / 2 + (r() - 0.5) * 40, y - 4, 150, 42, (r() - 0.5) * 0.3, r);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 14;
  assinatura(ctx, marca, w - 70, zona === 'base' ? F.topo + 10 : h - F.base + 20, '#ffffff', 'right', logo, 28);
  ctx.restore();
}

function tLista(ctx, F, { spec, marca, foto, logo, par, cores, r }) {
  const { w, h } = F;
  const story = F === FORMATOS.story;
  const fundo = spec.paleta === 'marca' || spec.paleta === 'escura' ? cores.fundo : cores.clara;
  const texto = melhorTexto(fundo, [cores.escura, cores.clara, '#141414', '#ffffff']);
  const acento = [cores.acento, coresDaMarca(marca).destaque, coresDaMarca(marca).primaria].find((c) => c !== fundo && contraste(c, fundo) > 1.8) || texto;
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, w, h);
  grao(ctx, w, h, 0.14);
  const m = 84;
  ctx.fillStyle = texto;
  const { tam, linhas } = caber(ctx, spec.titulo, par.titulo, { largura: w - m * 2, altura: story ? 420 : 330, max: 100, min: 44, entrelinha: 1.03, maxLinhas: 3 });
  fonte(ctx, par.titulo, tam);
  let y = escrever(ctx, linhas, m, F.topo + 30, tam, 1.03) + (story ? 70 : 50);
  const itens = (spec.itens || []).slice(0, 5);
  const temFoto = !!foto;
  const larguraItem = w - m * 2 - 110 - (temFoto ? 250 : 0);
  const espacoItens = h - y - F.base - 110;
  const passo = Math.min(story ? 190 : 150, espacoItens / Math.max(1, itens.length));
  itens.forEach((item, i) => {
    const yy = y + i * passo;
    fonte(ctx, par.titulo, 76);
    ctx.fillStyle = acento;
    ctx.textAlign = 'left';
    ctx.fillText(String(i + 1), m, yy + 70);
    ctx.fillStyle = texto;
    const { tam: t2, linhas: l2 } = caber(ctx, item, { ...par.texto, peso: 600 }, { largura: larguraItem, altura: passo - 30, max: story ? 50 : 44, min: 28, entrelinha: 1.2, maxLinhas: 2 });
    fonte(ctx, { ...par.texto, peso: 600 }, t2);
    escrever(ctx, l2, m + 110, yy + 22, t2, 1.2);
  });
  if (temFoto) {
    const s = 300;
    const fx = w - m - s + 20;
    const fy = h - F.base - s - 60;
    ctx.save();
    ctx.translate(fx + s / 2, fy + s / 2);
    ctx.rotate(0.05 + r() * 0.04);
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#fbfaf7';
    ctx.fillRect(-s / 2 - 16, -s / 2 - 16, s + 32, s + 32);
    ctx.shadowColor = 'transparent';
    cobrir(ctx, foto, -s / 2, -s / 2, s, s, spec.focal);
    ctx.restore();
    fita(ctx, fx + s / 2, fy - 10, 130, 38, -0.12, r);
  }
  ctx.save();
  ctx.translate(m, h - F.base + (story ? -20 : 10));
  ctx.rotate(-0.03);
  fonte(ctx, MANUSCRITO, 50);
  ctx.fillStyle = acento;
  ctx.fillText(spec.apoio || 'salva para depois', 0, 0);
  ctx.restore();
  if (!temFoto) assinatura(ctx, marca, w - m, h - F.base + (story ? -20 : 10), alpha(texto, 0.7), 'right', logo, 28);
}

function tAviso(ctx, F, { spec, marca, logo, par, cores, r }) {
  const { w, h } = F;
  const story = F === FORMATOS.story;
  ctx.fillStyle = cores.fundo;
  ctx.fillRect(0, 0, w, h);
  grao(ctx, w, h, 0.15);
  const m = 84;
  ctx.fillStyle = cores.texto;
  const { tam, linhas } = caber(ctx, spec.titulo, par.titulo, { largura: w - m * 2, altura: h - F.topo - F.base - (story ? 420 : 300), max: story ? 170 : 150, min: 56, entrelinha: 1.0, maxLinhas: 6 });
  fonte(ctx, par.titulo, tam);
  const altura = linhas.length * tam;
  const y0 = F.topo + (h - F.topo - F.base - altura) * 0.38;
  const yFim = escrever(ctx, linhas, m, y0, tam, 1.0);
  const ultima = linhas[linhas.length - 1] || '';
  marcador(ctx, m - 6, m + ctx.measureText(ultima).width + 6, yFim + 8, Math.max(10, tam * 0.1), cores.acento, r);
  if (spec.apoio) {
    ctx.save();
    ctx.translate(m, yFim + 120);
    ctx.rotate(-0.035);
    fonte(ctx, MANUSCRITO, story ? 70 : 58);
    ctx.fillStyle = cores.acento;
    ctx.fillText(spec.apoio, 0, 0);
    // setinha desenhada à mão
    const lw = ctx.measureText(spec.apoio).width;
    ctx.strokeStyle = cores.acento;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lw + 24, -18);
    ctx.quadraticCurveTo(lw + 80, -30 + r() * 10, lw + 110, 20);
    ctx.moveTo(lw + 110, 20);
    ctx.lineTo(lw + 84, 12);
    ctx.moveTo(lw + 110, 20);
    ctx.lineTo(lw + 112, -8);
    ctx.stroke();
    ctx.restore();
  }
  assinatura(ctx, marca, m, h - F.base + (story ? -20 : 10), alpha(cores.texto, 0.75), 'left', logo, 30);
}

function tCitacao(ctx, F, { spec, marca, foto, logo, par, cores }) {
  const { w, h } = F;
  ctx.fillStyle = cores.fundo;
  ctx.fillRect(0, 0, w, h);
  grao(ctx, w, h, 0.14);
  const m = 90;
  fonte(ctx, par.titulo, 320);
  ctx.fillStyle = cores.acento;
  ctx.textAlign = 'left';
  ctx.fillText('“', m - 20, F.topo + 250);
  ctx.fillStyle = cores.texto;
  const { tam, linhas } = caber(ctx, spec.titulo, par.titulo, { largura: w - m * 2, altura: h * 0.45, max: 84, min: 40, entrelinha: 1.15, maxLinhas: 7 });
  fonte(ctx, par.titulo, tam);
  const y = escrever(ctx, linhas, m, F.topo + 280, tam, 1.15);
  if (spec.apoio) {
    fonte(ctx, { ...par.texto, peso: 650 }, 36);
    ctx.globalAlpha = 0.85;
    ctx.fillText(spec.apoio, m, y + 70);
    ctx.globalAlpha = 1;
  }
  if (foto) {
    const s = 180;
    ctx.save();
    ctx.beginPath();
    ctx.arc(w - m - s / 2, h - F.base - s / 2, s / 2, 0, Math.PI * 2);
    ctx.clip();
    cobrir(ctx, foto, w - m - s, h - F.base - s, s, s, spec.focal);
    ctx.restore();
  }
  assinatura(ctx, marca, m, h - F.base + 10, alpha(cores.texto, 0.7), 'left', logo, 28);
}

const DESENHOS = { manchete: tManchete, moldura: tMoldura, recorte: tRecorte, etiqueta: tEtiqueta, lista: tLista, aviso: tAviso, citacao: tCitacao };

// Desenha a arte no canvas. `escala` < 1 para miniaturas.
export async function renderizar(canvas, { spec, marca, foto, logo, formato = 'feed', escala = 1 }) {
  const F = FORMATOS[formato] || FORMATOS.feed;
  const par = parDaMarca(marca);
  await carregarFontes(par);
  canvas.width = Math.round(F.w * escala);
  canvas.height = Math.round(F.h * escala);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  const r = aleatorio(spec?.seed || 7);
  const cores = paleta(marca, spec?.paleta || 'marca');
  const desenhar = DESENHOS[spec?.template] || tAviso;
  desenhar(ctx, F, { spec: { ...spec, titulo: spec?.titulo || marca?.nome || '' }, marca, foto: foto || null, logo: logo || null, par, cores, r });
  return canvas;
}

export async function renderizarBlob(opcoes) {
  const c = document.createElement('canvas');
  await renderizar(c, opcoes);
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
}

export { luminancia };
