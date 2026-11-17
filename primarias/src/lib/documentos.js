// Documentos gerados no aparelho: download de arquivos e o PDF do checklist
// de entrega com as 8 fotos de cada forno (uma página A4 deitada por forno).
import { SLOTS_FOTO, LADOS, rotulo, localMedicao, CLIENTE } from '../data/obra.js';
import { lerFotos } from './banco.js';
import { completa } from './datas.js';

export function baixar(bytes, nome, tipo = 'application/octet-stream') {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** "Gestão Visual.xlsx" → "Gestão Visual (app 17-11-2026).xlsx" */
export function nomeAtualizado(original, data = new Date()) {
  const carimbo = `${String(data.getDate()).padStart(2, '0')}-${String(data.getMonth() + 1).padStart(2, '0')}-${data.getFullYear()}`;
  const m = /^(.*?)(?: \(app [\d-]+\))?(\.[^.]+)$/.exec(original || 'planilha.xlsx');
  return `${m[1]} (app ${carimbo})${m[2]}`;
}

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const TIPO_XLSM = 'application/vnd.ms-excel.sheet.macroEnabled.12';

/** Reduz a foto para o PDF do BM não ficar enorme. */
function reduzir(dataUrl, maxLado, qualidade) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
      if (k >= 1) return ok({ dataUrl, w: img.naturalWidth, h: img.naturalHeight });
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      ok({ dataUrl: c.toDataURL('image/jpeg', qualidade), w: c.width, h: c.height });
    };
    img.onerror = () => ok(null);
    img.src = dataUrl;
  });
}

const SITUACAO = { pendente: 'sem fotos', rascunho: 'fotos em andamento', enviado: 'enviado para aprovação', devolvido: 'devolvido para ajuste' };

const dataDe = (v) => {
  if (!v) return '';
  if (typeof v === 'number') return completa(new Date(v).toISOString().slice(0, 10));
  if (typeof v.toDate === 'function') return completa(v.toDate().toISOString().slice(0, 10));
  return '';
};

/**
 * PDF com o checklist de cada forno. itens: [{ fid, concluidoEm, checklist }].
 * reduzido: fotos menores (para o PDF do BM inteiro).
 */
export async function pdfChecklists(itens, { reduzido = false, aoProgresso = null } = {}) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const H = 210;
  const m = 12;
  const azul = [28, 68, 151];
  let primeira = true;
  let semFotos = 0;
  for (let k = 0; k < itens.length; k++) {
    const it = itens[k];
    aoProgresso?.(k, itens.length);
    const fotos = await lerFotos(it.fid);
    if (!Object.keys(fotos).length) semFotos++;
    if (!primeira) pdf.addPage();
    primeira = false;
    const ck = it.checklist || {};
    // cabeçalho
    pdf.setFillColor(...azul);
    pdf.rect(0, 0, W, 22, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text('CHECKLIST DE ENTREGA DO FORNO', m, 10);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.text(`Reframax Engenharia · ${CLIENTE} · Substituição das válvulas primárias`, m, 16.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text(ck.numero ? `Nº ${ck.numero}` : 'Sem número', W - m, 13.5, { align: 'right' });
    pdf.setTextColor(25, 30, 40);
    pdf.setFontSize(13);
    pdf.text(`${rotulo(it.fid)}   (${localMedicao(it.fid)})`, m, 31);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    const linha = [
      it.concluidoEm ? `Forno concluído em ${completa(it.concluidoEm)}` : 'Forno em obra',
      ck.status === 'aprovado' ? `Aprovado${ck.aprovadoPor ? ` por ${ck.aprovadoPor}` : ''}${dataDe(ck.aprovadoEm) ? ` em ${dataDe(ck.aprovadoEm)}` : ''}` : `Situação: ${SITUACAO[ck.status] || 'sem fotos'}`,
      ck.enviadoPor ? `Fotos enviadas por ${ck.enviadoPor}` : ''
    ].filter(Boolean).join('   ·   ');
    pdf.text(linha, m, 37);
    // 2 linhas (LM, LC) × 4 fotos
    const topo = 42;
    const gap = 5;
    const larg = (W - 2 * m - 3 * gap) / 4;
    const altLinha = (H - topo - m - 4) / 2;
    const altImg = altLinha - 19;
    for (const [li, lado] of LADOS.entries()) {
      const y0 = topo + li * altLinha;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.setTextColor(...azul);
      pdf.text(lado.nome.toUpperCase(), m, y0 + 4);
      const slots = SLOTS_FOTO.filter((s) => s.lado === lado.id);
      for (const [ci, s] of slots.entries()) {
        const x = m + ci * (larg + gap);
        const y = y0 + 7;
        pdf.setDrawColor(200, 206, 216);
        pdf.setFillColor(244, 246, 250);
        pdf.rect(x, y, larg, altImg, 'FD');
        const f = fotos[s.id];
        if (f?.imagem) {
          const img = reduzido ? await reduzir(f.imagem, 900, 0.72) : { dataUrl: f.imagem, w: f.largura, h: f.altura };
          if (img) {
            const proporcao = img.w && img.h ? img.w / img.h : 4 / 3;
            let w = larg;
            let h = w / proporcao;
            if (h > altImg) {
              h = altImg;
              w = h * proporcao;
            }
            pdf.addImage(img.dataUrl, 'JPEG', x + (larg - w) / 2, y + (altImg - h) / 2, w, h, undefined, 'FAST');
          }
        } else {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(140, 146, 160);
          pdf.text(ck.origem === 'planilha' ? 'Aprovado antes do app' : 'Sem foto', x + larg / 2, y + altImg / 2, { align: 'center' });
        }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(25, 30, 40);
        pdf.text(`${s.nome}`, x, y + altImg + 4.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(95, 102, 118);
        const quem = f ? `${f.autor?.nome || ''}${f.tiradaEmLocal ? ` · ${new Date(f.tiradaEmLocal).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}` : s.desc;
        pdf.text(quem, x, y + altImg + 8.5, { maxWidth: larg });
      }
    }
    pdf.setFontSize(7.5);
    pdf.setTextColor(140, 146, 160);
    pdf.text(`Gerado pelo app Primárias em ${new Date().toLocaleString('pt-BR')}`, W - m, H - 5, { align: 'right' });
  }
  aoProgresso?.(itens.length, itens.length);
  return { blob: pdf.output('blob'), semFotos };
}
