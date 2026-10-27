// Gera os ícones do app Primárias (public/icons/icon-192.png e icon-512.png):
// as 6 primárias de um forno (3 do lado máquina em cima, 3 do lado coque
// embaixo) em brasa, no fundo carvão. Desenho pixel a pixel, sem bibliotecas.
// Rode de novo se mudar as cores da marca: node primarias/scripts/gerar-icones.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [20, 16, 14]; // #14100e
const BRASA_A = [255, 90, 20]; // #ff5a14
const BRASA_B = [255, 176, 46]; // #ffb02e

function lerp(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function drawIcon(size) {
  const px = new Uint8ClampedArray(size * size * 4);
  // área segura da máscara circular do Android: ~60% do centro
  const cel = size * 0.15;
  const gap = size * 0.045;
  const larg = cel * 3 + gap * 2;
  const alt = cel * 2 + gap * 1.6;
  const x0 = (size - larg) / 2;
  const y0 = (size - alt) / 2;
  const raio = cel * 0.22;
  const dentro = (x, y, cx, cy) => {
    const dx = Math.max(Math.abs(x - cx) - (cel / 2 - raio), 0);
    const dy = Math.max(Math.abs(y - cy) - (cel / 2 - raio), 0);
    return dx * dx + dy * dy <= raio * raio;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = BG;
      for (let lin = 0; lin < 2; lin++) {
        for (let col = 0; col < 3; col++) {
          const cx = x0 + col * (cel + gap) + cel / 2;
          const cy = y0 + lin * (cel + gap * 1.6) + cel / 2;
          if (dentro(x, y, cx, cy)) color = lerp(BRASA_A, BRASA_B, (x - x0 + (y - y0) * 0.6) / (larg + alt * 0.6));
        }
      }
      const idx = (y * size + x) * 4;
      px[idx] = color[0];
      px[idx + 1] = color[1];
      px[idx + 2] = color[2];
      px[idx + 3] = 255;
    }
  }
  return px;
}

function encodePNG(size) {
  const px = drawIcon(size);
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filtro "none"
    Buffer.from(px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(raw, { level: 9 });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync(new URL('../public/icons', import.meta.url), { recursive: true });
for (const size of [192, 512]) {
  const png = encodePNG(size);
  writeFileSync(new URL(`../public/icons/icon-${size}.png`, import.meta.url), png);
  console.log(`gerado primarias/public/icons/icon-${size}.png (${png.length} bytes)`);
}
