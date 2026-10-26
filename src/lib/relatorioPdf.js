import { calcularIndicadores, planejadoRealPorProjeto, serieTemporal } from '../utils/indicadores.js';
import { formatMinutes, formatDateBR, efetivoTotal, excedenteMinutos, classificacaoDoLancamento, CLASSIFICACAO_INFO } from '../utils/format.js';
import { contramedida, NIVEIS } from './agentes.js';

/**
 * Relatório gerencial em PDF (A4 retrato), gerado no próprio navegador.
 * Começa pelo que o gestor procura: os números do período, uma leitura em
 * frases e os gráficos; depois planejado × realizado, quem lançou, as
 * sugestões do assistente e, no anexo, todos os lançamentos. Os gráficos
 * são desenhados direto no PDF (vetor): ficam nítidos no zoom e na impressão.
 */

const COR = {
  escuro: '0D1630',
  marca: '2B5FEA',
  marcaClara: '93B4FF',
  texto: '1A1F2E',
  suave: '5B6275',
  linha: 'E3E6EE',
  cartao: 'F1F4FB',
  branco: 'FFFFFF',
  // as mesmas do app e do PowerPoint: verde = produtivo/valor, âmbar = necessário,
  // vermelho escuro = perda; claridades bem diferentes para não depender só do tom
  VA: '2EAD5F',
  DN: 'F2B705',
  DNN: 'B91C1C',
  ambarEscuro: '9A6B00',
  bom: '1E9E5A'
};
const NIVEL_COR = { critico: 'D64553', atencao: 'C98500', oportunidade: '1E9E5A', info: '2B5FEA' };
const LEAN = [
  ['VA', 'Valor Agregado', 'transforma o serviço: aplicar, montar, assentar'],
  ['DN', 'Desperdício Necessário', 'necessário hoje: acesso, preparação, excedente do planejado'],
  ['DNN', 'Desperdício Não Necessário', 'perda evitável: esperas, falta de material, retrabalho']
];

const A4 = { w: 595.28, h: 841.89 };
const M = 40; // margem
const W = A4.w - 2 * M; // largura útil
const RODAPE = 44; // faixa reservada ao rodapé

const rgb = (hex) => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
const pctTxt = (v) => (v == null || !Number.isFinite(v) ? '—' : `${Math.round(v * 100)}%`);
const num = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const horasTxt = (min) => ((Number(min) || 0) >= 600 ? `${Math.round(min / 60).toLocaleString('pt-BR')} h` : formatMinutes(min));
const dataHora = (d) => `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

/** Passo "redondo" para as linhas de grade (1, 2, 2,5, 5 × 10ⁿ). */
function passoRedondo(bruto) {
  const mag = 10 ** Math.floor(Math.log10(bruto || 1));
  const n = bruto / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

/** Frases curtas com o "e daí?" dos números — o que o gestor leria primeiro. */
function leituraRapida(ind, porProjeto) {
  const total = ind.totalMin || 1;
  const frases = [
    `${pctTxt(ind.prodMin / total)} do tempo apontado foi produtivo (${formatMinutes(ind.prodMin)} de ${formatMinutes(ind.totalMin)}); ${formatMinutes(ind.improdMin)} foram paradas.`
  ];
  if (ind.lean.DNN > 0) frases.push(`Desperdício evitável (DNN): ${formatMinutes(ind.lean.DNN)}, ${pctTxt(ind.lean.DNN / total)} do total. É o tempo que dá para recuperar atacando as causas de parada.`);
  const parada = ind.topImprodutividades[0];
  if (parada) frases.push(`Maior causa de parada: ${parada.label}, com ${formatMinutes(parada.value)} (${pctTxt(parada.value / (ind.improdMin || 1))} do tempo parado).`);
  const estouro = ind.topExcedente[0];
  if (estouro) frases.push(`Atividade que mais passou do planejado: ${estouro.label} (+${formatMinutes(estouro.value)}). No total, ${formatMinutes(ind.excedenteMin)} acima do planejado.`);
  if (ind.aderenciaTempo != null) {
    const equipe = ind.divergenciaEfetivo != null ? ` ${pctTxt(ind.divergenciaEfetivo)} usaram equipe diferente da planejada.` : '';
    frases.push(`${pctTxt(ind.aderenciaTempo)} dos ${ind.comPadrao} lançamentos com tempo planejado ficaram dentro dele.${equipe}`);
  }
  const pior = porProjeto.find((x) => x.desvio != null && x.desvio > 0.05);
  if (pior) frases.push(`Projeto com maior desvio: ${pior.projeto.nome}, com o realizado ${pctTxt(pior.desvio)} acima do planejado nas etapas já executadas.`);
  return frases;
}

/** Monta o relatório num jsPDF já criado (testável fora do navegador). */
export function montarRelatorioPdf(doc, autoTable, { lancamentos, periodo, filtros, projetos = [], achados = [], geradoEm = new Date() }) {
  const ind = calcularIndicadores(lancamentos);
  const total = ind.totalMin || 1;
  const porProjeto = planejadoRealPorProjeto(projetos, lancamentos).sort((a, b) => (b.desvio ?? -Infinity) - (a.desvio ?? -Infinity));
  let y = M;

  doc.setProperties({ title: 'Relatório de Tempos e Métodos', author: 'REFRAMAX Tempos & Métodos', creator: 'REFRAMAX Tempos & Métodos' });

  // ---- primitivas de desenho ------------------------------------------------
  const preencher = (hex) => doc.setFillColor(...rgb(hex));
  const tracar = (hex, largura = 0.5) => { doc.setDrawColor(...rgb(hex)); doc.setLineWidth(largura); };
  const fonte = (tam, estilo = 'normal') => { doc.setFont('helvetica', estilo); doc.setFontSize(tam); };
  const texto = (t, x, yy, { tam = 10, estilo = 'normal', cor = COR.texto, align = 'left' } = {}) => {
    fonte(tam, estilo);
    doc.setTextColor(...rgb(cor));
    doc.text(String(t), x, yy, { align });
  };
  const quebrar = (t, largura, tam, estilo = 'normal') => { fonte(tam, estilo); return doc.splitTextToSize(String(t), largura); };
  const umaLinha = (t, largura, tam, estilo = 'normal') => {
    const ls = quebrar(t, largura, tam, estilo);
    if (ls.length <= 1) return ls[0] || '';
    let s = ls[0];
    while (s && doc.getTextWidth(`${s}…`) > largura) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  };
  const cabe = (altura) => y + altura <= A4.h - RODAPE - 6;
  const garantir = (altura) => { if (!cabe(altura)) { doc.addPage(); y = M; } };
  /** Título de seção; `conteudo` é a altura do que vem logo abaixo, para não ficarem em páginas diferentes. */
  const secao = (titulo, sub, conteudo = 60) => {
    garantir(36 + conteudo);
    texto(titulo, M, y + 12, { tam: 13, estilo: 'bold' });
    y += 18;
    if (sub) { texto(sub, M, y + 8, { tam: 8.5, cor: COR.suave }); y += 14; }
    y += 8;
  };
  const legenda = (itens, xDireita, yy) => {
    fonte(8);
    let x = xDireita;
    [...itens].reverse().forEach(([cor, rotulo]) => {
      x -= doc.getTextWidth(rotulo);
      texto(rotulo, x, yy + 7, { tam: 8, cor: COR.suave });
      x -= 12;
      preencher(cor);
      doc.rect(x, yy, 8, 8, 'F');
      x -= 14;
    });
  };

  /** Barras horizontais com o rótulo à esquerda e o valor escrito no fim da barra. */
  const barrasH = (itens, { cor, valor, labelW = 196 }) => {
    const linhaH = 19;
    const valorW = 96;
    const max = Math.max(...itens.map((i) => i.value), 1);
    const barX = M + labelW + 8;
    const barW = W - labelW - 8 - valorW;
    itens.forEach((it) => {
      garantir(linhaH);
      texto(umaLinha(it.label, labelW, 8.8), M, y + 10, { tam: 8.8 });
      const w = Math.max(1.5, (it.value / max) * barW);
      preencher(cor);
      doc.rect(barX, y + 2, w, 11, 'F');
      texto(valor(it), barX + w + 6, y + 10.5, { tam: 8.5, estilo: 'bold' });
      y += linhaH;
    });
    y += 6;
  };

  /** Colunas empilhadas: improdutivo (vermelho) na base, produtivo (verde) em cima — igual ao dashboard. */
  const colunas = (serie, altura) => {
    const eixoW = 36;
    const x = M + eixoW;
    const w = W - eixoW;
    legenda([[COR.VA, 'Produtivo'], [COR.DNN, 'Improdutivo']], M + W, y);
    const topo = y + 18;
    const h = altura - 40;
    const maxH = Math.max(...serie.map((d) => (d.prod + d.improd) / 60), 0.1);
    const passo = passoRedondo(maxH / 4);
    const teto = Math.ceil(maxH / passo - 1e-9) * passo;
    for (let v = 0; v <= teto + 1e-9; v += passo) {
      const yy = topo + h - (v / teto) * h;
      tracar(COR.linha);
      doc.line(x, yy, x + w, yy);
      texto(`${num(v)} h`, x - 6, yy + 3, { tam: 7, cor: COR.suave, align: 'right' });
    }
    const slot = w / serie.length;
    const bw = Math.min(slot * 0.64, 26);
    const pulo = Math.max(1, Math.ceil(serie.length / 12));
    const base = topo + h;
    serie.forEach((d, i) => {
      const cx = x + slot * i + slot / 2;
      const hi = (d.improd / 60 / teto) * h;
      const hp = (d.prod / 60 / teto) * h;
      if (hi > 0) { preencher(COR.DNN); doc.rect(cx - bw / 2, base - hi, bw, hi, 'F'); }
      if (hp > 0) { preencher(COR.VA); doc.rect(cx - bw / 2, base - hi - hp, bw, hp, 'F'); }
      if (i % pulo === 0) texto(d.label, cx, base + 11, { tam: 6.8, cor: COR.suave, align: 'center' });
    });
    y = base + 24;
  };

  /** Caixa de destaque com faixa colorida à esquerda. */
  const caixa = (corFaixa, linhasTitulo, linhasCorpo) => {
    const h = 14 + linhasTitulo.length * 12 + linhasCorpo.length * 11.5 + 6;
    garantir(h);
    preencher(COR.cartao);
    doc.rect(M, y, W, h, 'F');
    preencher(corFaixa);
    doc.rect(M, y, 3.5, h, 'F');
    linhasTitulo.forEach((l, j) => texto(l, M + 14, y + 16 + j * 12, { tam: 9.5, estilo: 'bold' }));
    linhasCorpo.forEach((l, j) => texto(l, M + 14, y + 16 + linhasTitulo.length * 12 + j * 11.5, { tam: 9, cor: COR.suave }));
    y += h + 10;
  };

  const tabela = (opcoes) => {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: M, bottom: RODAPE + 8 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: rgb(COR.texto), lineColor: rgb(COR.linha), lineWidth: 0.5 },
      headStyles: { fillColor: rgb(COR.marca), textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 249, 252] },
      ...opcoes
    });
    y = doc.lastAutoTable.finalY + 22;
  };

  // ---- 1. capa e resumo -------------------------------------------------------
  preencher(COR.escuro);
  doc.rect(0, 0, A4.w, 106, 'F');
  texto('REFRAMAX · TEMPOS & MÉTODOS', M, 34, { tam: 8.5, estilo: 'bold', cor: COR.marcaClara });
  texto('Relatório de Tempos e Métodos', M, 61, { tam: 21, estilo: 'bold', cor: COR.branco });
  texto(umaLinha(`Período: ${periodo}  ·  ${filtros}`, W, 9.5), M, 81, { tam: 9.5, cor: 'C9D3EC' });
  texto(`Gerado em ${dataHora(geradoEm)}  ·  ${ind.n} lançamentos`, M, 95, { tam: 8.5, cor: '8E9BBD' });
  y = 124;

  const va = ind.lean.VA / total;
  const kpis = [
    { valor: horasTxt(ind.totalMin), rotulo: `apontadas em ${ind.n} lançamentos`, cor: COR.marca },
    { valor: pctTxt(ind.prodMin / total), rotulo: 'do tempo em atividades produtivas', cor: COR.VA },
    { valor: pctTxt(va), rotulo: 'foi Valor Agregado (Lean)', cor: va >= 0.5 ? COR.VA : COR.ambarEscuro },
    { valor: pctTxt(ind.aderenciaTempo), rotulo: ind.comPadrao ? 'dos lançamentos dentro do tempo planejado' : 'sem tempo planejado para comparar', cor: COR.marca }
  ];
  const gap = 10;
  const cw = (W - gap * 3) / 4;
  kpis.forEach((k, i) => {
    const x = M + i * (cw + gap);
    preencher(COR.cartao);
    doc.roundedRect(x, y, cw, 66, 6, 6, 'F');
    texto(k.valor, x + 12, y + 30, { tam: 20, estilo: 'bold', cor: k.cor });
    quebrar(k.rotulo, cw - 24, 8).slice(0, 2).forEach((l, j) => texto(l, x + 12, y + 46 + j * 10, { tam: 8, cor: COR.suave }));
  });
  y += 66 + 24;

  const frases = leituraRapida(ind, porProjeto);
  secao('Leitura rápida', 'O que os números do período dizem', 40);
  frases.forEach((f) => {
    const ls = quebrar(f, W - 16, 10);
    garantir(ls.length * 13 + 5);
    preencher(COR.marca);
    doc.circle(M + 3, y + 4, 2, 'F');
    ls.forEach((l, j) => texto(l, M + 14, y + 7.5 + j * 13, { tam: 10 }));
    y += ls.length * 13 + 5;
  });
  y += 12;

  // ---- 2. como o tempo foi usado --------------------------------------------
  secao('Como o tempo foi usado', 'Classificação Lean de cada minuto apontado', 86);
  let x0 = M;
  LEAN.forEach(([k]) => {
    const w = (ind.lean[k] / total) * W;
    if (w <= 0) return;
    preencher(COR[k]);
    doc.rect(x0, y, w, 26, 'F');
    const rot = pctTxt(ind.lean[k] / total);
    fonte(10, 'bold');
    if (doc.getTextWidth(rot) + 10 < w) texto(rot, x0 + w / 2, y + 17, { tam: 10, estilo: 'bold', cor: k === 'DN' ? COR.texto : COR.branco, align: 'center' });
    x0 += w;
  });
  y += 26 + 14;
  const colW = W / 3;
  LEAN.forEach(([k, nome, desc], i) => {
    const x = M + i * colW;
    preencher(COR[k]);
    doc.rect(x, y, 9, 9, 'F');
    texto(`${nome}`, x + 14, y + 8, { tam: 9, estilo: 'bold' });
    texto(`${pctTxt(ind.lean[k] / total)} · ${formatMinutes(ind.lean[k])}`, x + 14, y + 20, { tam: 9, cor: k === 'DN' ? COR.ambarEscuro : COR[k], estilo: 'bold' });
    quebrar(desc, colW - 22, 7.8).slice(0, 2).forEach((l, j) => texto(l, x + 14, y + 31 + j * 9.5, { tam: 7.8, cor: COR.suave }));
  });
  y += 56;

  const serie = serieTemporal(ind.porDia);
  if (serie.length >= 2) {
    const semanal = serie[0].label.startsWith('Sem');
    secao('Produtivo × improdutivo ao longo do período', semanal ? 'Horas apontadas por semana' : 'Horas apontadas por dia', 190);
    colunas(serie, 190);
  }

  // ---- 3. paradas e excedentes ------------------------------------------------
  const paradas = ind.topImprodutividades.slice(0, 8);
  if (paradas.length) {
    secao('Onde a equipe mais ficou parada', 'Improdutividades somadas no período, da maior para a menor', paradas.length * 19 + 50);
    barrasH(paradas, { cor: COR.DNN, valor: (it) => `${formatMinutes(it.value)} · ${pctTxt(it.value / (ind.improdMin || 1))}` });
    caixa(COR.DNN, quebrar(`O que fazer com a maior causa: ${paradas[0].label}`, W - 28, 9.5, 'bold'), quebrar(contramedida(paradas[0].label), W - 28, 9));
  }

  const estouros = ind.topExcedente.slice(0, 6);
  if (estouros.length) {
    secao('Atividades que mais passam do planejado', 'Tempo somado acima do tempo planejado de cada atividade: o primeiro lugar para uma cronoanálise', estouros.length * 19);
    barrasH(estouros, { cor: COR.DN, valor: (it) => `+${formatMinutes(it.value)}` });
  }

  const atividades = ind.topAtividades.slice(0, 8);
  if (atividades.length) {
    secao('Onde as horas produtivas foram gastas', 'Atividades produtivas com mais tempo apontado', atividades.length * 19);
    barrasH(atividades, { cor: COR.VA, valor: (it) => `${formatMinutes(it.value)} · ${pctTxt(it.value / (ind.prodMin || 1))}` });
  }

  // ---- 4. planejado × realizado e equipe -------------------------------------
  if (porProjeto.length) {
    secao('Planejado × realizado por projeto', 'Cada lançamento é uma execução da etapa; o planejado soma o tempo previsto das execuções já feitas', 70);
    tabela({
      head: [['Projeto', 'Contrato', 'Etapas iniciadas', 'Planejado', 'Realizado', 'Desvio', 'Divergências']],
      body: porProjeto.map((x) => [
        x.projeto.nome,
        x.projeto.contratoNome || '—',
        `${x.iniciadas} de ${x.etapas}`,
        formatMinutes(x.planejadoMin),
        formatMinutes(x.realMin),
        x.desvio == null ? '—' : `${x.desvio > 0 ? '+' : ''}${Math.round(x.desvio * 100)}%`,
        String(x.divergencias)
      ]),
      columnStyles: { 0: { cellWidth: 150 }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'center' } },
      didParseCell: (d) => {
        if (d.section !== 'body' || d.column.index !== 5) return;
        const v = porProjeto[d.row.index].desvio;
        if (v > 0.1) d.cell.styles.textColor = rgb(COR.DNN);
        else if (v < -0.1) d.cell.styles.textColor = rgb(COR.bom);
      }
    });
  }

  const porPessoa = new Map();
  lancamentos.forEach((l) => {
    const k = `${l.criadoPorUid || ''}|${l.criadoPorNome || '—'}`;
    if (!porPessoa.has(k)) porPessoa.set(k, { nome: l.criadoPorNome || '—', n: 0, total: 0, improd: 0, excedente: 0 });
    const p = porPessoa.get(k);
    const dur = Number(l.duracaoMinutos) || 0;
    p.n++;
    p.total += dur;
    if (l.tipoRegistro === 'improdutividade') p.improd += dur;
    p.excedente += excedenteMinutos(l);
  });
  const pessoas = [...porPessoa.values()].sort((a, b) => b.total - a.total);
  if (pessoas.length) {
    secao('Apontamentos por lançador', 'Quem registrou, quanto tempo e quanto dele foi parada', 60);
    tabela({
      head: [['Lançado por', 'Lançamentos', 'Tempo apontado', 'Parado', 'Acima do planejado']],
      body: pessoas.map((p) => [p.nome, String(p.n), formatMinutes(p.total), `${formatMinutes(p.improd)} (${pctTxt(p.improd / (p.total || 1))})`, p.excedente ? `+${formatMinutes(p.excedente)}` : '—']),
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
    });
  }

  // ---- 5. sugestões ----------------------------------------------------------
  const sugestoes = achados.filter((a) => a.area !== 'Sistema').slice(0, 8); // backup e saúde do app não são assunto do relatório
  if (sugestoes.length) {
    secao('Sugestões de melhoria', 'Pontos levantados pelo assistente do app, do mais urgente para o menos urgente', 70);
    sugestoes.forEach((a, i) => {
      const titulo = quebrar(`${i + 1}. ${a.titulo}`, W - 28, 9.5, 'bold');
      const corpo = quebrar(a.sugestao || a.detalhe || '', W - 28, 9);
      const nivel = NIVEIS[a.nivel] || NIVEIS.info;
      const h = 26 + titulo.length * 12 + corpo.length * 11.5;
      garantir(h + 8);
      preencher(COR.cartao);
      doc.rect(M, y, W, h, 'F');
      preencher(NIVEL_COR[a.nivel] || COR.marca);
      doc.rect(M, y, 3.5, h, 'F');
      texto(`${nivel.label.toUpperCase()} · ${String(a.area || '').toUpperCase()}`, M + 14, y + 13, { tam: 7.2, estilo: 'bold', cor: NIVEL_COR[a.nivel] || COR.marca });
      titulo.forEach((l, j) => texto(l, M + 14, y + 27 + j * 12, { tam: 9.5, estilo: 'bold' }));
      corpo.forEach((l, j) => texto(l, M + 14, y + 27 + titulo.length * 12 + j * 11.5, { tam: 9, cor: COR.suave }));
      y += h + 8;
    });
  }

  // ---- 6. anexo ----------------------------------------------------------------
  doc.addPage();
  y = M;
  secao('Anexo — lançamentos do período', `${lancamentos.length} registros, do mais recente para o mais antigo`, 40);
  const ordenados = [...lancamentos].sort((a, b) => `${b.data}${b.horaInicio}`.localeCompare(`${a.data}${a.horaInicio}`));
  tabela({
    head: [['Data', 'Horário', 'Duração', 'Tipo', 'Lean', 'Atividade / projeto', 'Equipe', 'Lançado por']],
    body: ordenados.map((l) => [
      formatDateBR(l.data),
      `${l.horaInicio}–${l.horaTermino}`,
      formatMinutes(l.duracaoMinutos),
      l.tipoRegistro === 'improdutividade' ? 'Parada' : 'Produtiva',
      CLASSIFICACAO_INFO[classificacaoDoLancamento(l)].short,
      `${l.atividadeNome || '—'}\n${l.projetoNome || 'Avulso'}`,
      efetivoTotal(l.efetivo) ? String(efetivoTotal(l.efetivo)) : '—',
      l.criadoPorNome || '—'
    ]),
    styles: { font: 'helvetica', fontSize: 7.4, cellPadding: 3, textColor: rgb(COR.texto), lineColor: rgb(COR.linha), lineWidth: 0.4 },
    columnStyles: { 0: { cellWidth: 48 }, 1: { cellWidth: 56 }, 2: { cellWidth: 44 }, 3: { cellWidth: 44 }, 4: { cellWidth: 28, fontStyle: 'bold' }, 6: { cellWidth: 34, halign: 'center' }, 7: { cellWidth: 74 } },
    didParseCell: (d) => {
      if (d.section !== 'body' || d.column.index !== 4) return;
      const k = classificacaoDoLancamento(ordenados[d.row.index]);
      d.cell.styles.textColor = rgb(k === 'DN' ? COR.ambarEscuro : COR[k]);
    }
  });

  // ---- rodapé em todas as páginas ----------------------------------------------
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    tracar(COR.linha);
    doc.line(M, A4.h - 32, A4.w - M, A4.h - 32);
    texto(`REFRAMAX · Tempos & Métodos — relatório de ${geradoEm.toLocaleDateString('pt-BR')} · ${periodo}`, M, A4.h - 20, { tam: 7.5, cor: COR.suave });
    texto(`Página ${i} de ${paginas}`, A4.w - M, A4.h - 20, { tam: 7.5, cor: COR.suave, align: 'right' });
  }
  return doc;
}

/** Gera e baixa o PDF (no navegador). As bibliotecas só carregam aqui. */
export async function gerarRelatorioPdf(dados) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = montarRelatorioPdf(new jsPDF({ unit: 'pt', format: 'a4' }), autoTable, dados);
  const d = new Date();
  doc.save(`reframax-relatorio-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.pdf`);
}
