// Fotos do checklist: a câmera do celular gera arquivos de 3 a 8 MB; aqui a
// foto é reduzida (lado maior até 1600 px, JPEG) para caber num documento do
// Firestore e subir rápido mesmo com sinal fraco. A legenda (forno, lado,
// primária, data e hora) vai gravada na própria imagem, como evidência.
export async function comprimirFoto(arquivo, { legenda = '', maxLado = 1600, limite = 600_000 } = {}) {
  const img = await carregar(arquivo);
  const larg = img.width || img.naturalWidth;
  const alt = img.height || img.naturalHeight;
  let lado = maxLado;
  let q = 0.78;
  let resultado = null;
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const esc = Math.min(1, lado / Math.max(larg, alt));
    const w = Math.round(larg * esc);
    const h = Math.round(alt * esc);
    const tela = document.createElement('canvas');
    tela.width = w;
    tela.height = h;
    const ctx = tela.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    if (legenda) carimbar(ctx, w, h, legenda);
    const dataUrl = tela.toDataURL('image/jpeg', q);
    resultado = { dataUrl, largura: w, altura: h, bytes: Math.round(dataUrl.length * 0.75) };
    if (dataUrl.length <= limite) break;
    if (q > 0.5) q -= 0.1;
    else lado = Math.round(lado * 0.8);
  }
  img.close?.();
  return resultado;
}

async function carregar(arquivo) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    } catch {
      /* navegador antigo: cai para <img> */
    }
  }
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      ok(img);
    };
    img.onerror = falha;
    img.src = url;
  });
}

function carimbar(ctx, w, h, texto) {
  const tam = Math.max(14, Math.round(w / 45));
  ctx.font = `600 ${tam}px Barlow, Arial, sans-serif`;
  const pad = Math.round(tam * 0.5);
  const larg = ctx.measureText(texto).width + pad * 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, h - tam - pad * 2, larg, tam + pad * 2);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, pad, h - (tam + pad * 2) / 2);
}
