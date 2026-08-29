// Gera os ícones PWA (public/icons/icon-192.png e icon-512.png) sem depender de
// bibliotecas externas de imagem — desenha pixel a pixel e codifica PNG na mão
// (zlib do próprio Node para o IDAT). Reexecute após alterar as cores da marca.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [11, 12, 15]; // #0b0c0f
const ACCENT_A = [255, 138, 61]; // #ff8a3d
const ACCENT_B = [255, 180, 84]; // #ffb454

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
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.33; // raio externo do anel (com folga p/ máscara circular do Android)
  const ring = size * 0.042; // espessura do anel
  const dotR = size * 0.03;

  // dois ponteiros partindo do centro: um curto para cima (12h), um longo para 2h
  const hands = [
    { angle: -Math.PI / 2, len: R * 0.55, w: size * 0.036 },
    { angle: -Math.PI / 2 + (Math.PI * 2) / 6, len: R * 0.8, w: size * 0.036 }
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const t = (angle + Math.PI) / (2 * Math.PI);
      let color = BG;
      let alpha = 255;

      const onRing = dist > R - ring && dist < R + ring;
      const onDot = dist < dotR;
      let onHand = false;
      for (const h of hands) {
        const along = dx * Math.cos(h.angle) + dy * Math.sin(h.angle);
        const perp = -dx * Math.sin(h.angle) + dy * Math.cos(h.angle);
        if (along > 0 && along < h.len && Math.abs(perp) < h.w / 2) onHand = true;
      }

      if (onRing || onHand || onDot) {
        color = lerp(ACCENT_A, ACCENT_B, t);
      }

      const idx = (y * size + x) * 4;
      px[idx] = color[0];
      px[idx + 1] = color[1];
      px[idx + 2] = color[2];
      px[idx + 3] = alpha;
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
  const path = new URL(`../public/icons/icon-${size}.png`, import.meta.url);
  writeFileSync(path, png);
  console.log(`gerado public/icons/icon-${size}.png (${png.length} bytes)`);
}
