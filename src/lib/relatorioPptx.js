import { calcularIndicadores, planejadoRealPorProjeto } from '../utils/indicadores.js';
import { formatMinutes } from '../utils/format.js';
import { contramedida, NIVEIS } from './agentes.js';

/**
 * Relatório de indicadores em PowerPoint, gerado no próprio navegador.
 * Os gráficos são nativos do PowerPoint (editáveis: dá para trocar cores,
 * rótulos e dados depois). Só monta os slides que têm dados.
 */

const COR = {
  escuro: '0D1630',
  marca: '2B5FEA',
  marcaClara: '93B4FF',
  texto: '1A1F2E',
  suave: '5B6275',
  cartao: 'EEF3FF',
  linha: 'E3E6EE',
  branco: 'FFFFFF',
  VA: '1E9E5A',
  DN: 'C98500',
  DNN: 'D64553'
};
const CABECALHO = 'Arial';
const CORPO = 'Calibri';
const NIVEL_COR = { critico: 'D64553', atencao: 'C98500', oportunidade: '1E9E5A', info: '2B5FEA' };

const horas = (min) => Math.round(((Number(min) || 0) / 60) * 10) / 10;
const pctTxt = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const corta = (t = '', max) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);
const dataBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Agrupa por semana quando o período é longo, para o gráfico não virar um pente. */
function serieTemporal(porDia) {
  if (porDia.length <= 31) return porDia.map((d) => ({ label: dataBR(d.data), prod: d.prod, improd: d.improd }));
  const semanas = new Map();
  porDia.forEach((d) => {
    const dt = new Date(`${d.data}T12:00:00`);
    dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); // segunda-feira da semana
    const k = dt.toISOString().slice(0, 10);
    if (!semanas.has(k)) semanas.set(k, { label: `Sem ${dataBR(k)}`, prod: 0, improd: 0 });
    semanas.get(k).prod += d.prod;
    semanas.get(k).improd += d.improd;
  });
  return [...semanas.values()];
}

function definirLayouts(pptx) {
  pptx.defineSlideMaster({
    title: 'CAPA',
    background: { color: COR.escuro },
    objects: [
      { text: { text: 'REFRAMAX', options: { x: 0.6, y: 0.55, w: 6, h: 0.5, fontFace: CABECALHO, fontSize: 16, bold: true, color: COR.marcaClara, charSpacing: 6, margin: 0 } } },
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 2.3, w: 11.5, h: 1.6, fontFace: CABECALHO, fontSize: 44, bold: true, color: COR.branco, align: 'left', valign: 'bottom', margin: 0 }, text: '' } },
      { placeholder: { options: { name: 'body', type: 'body', x: 0.6, y: 4.1, w: 11.5, h: 1.4, fontFace: CORPO, fontSize: 18, color: 'C9D3EC', align: 'left', valign: 'top', margin: 0 }, text: '' } }
    ]
  });
  pptx.defineSlideMaster({
    title: 'CONTEUDO',
    background: { color: COR.branco },
    margin: [0.5, 0.6, 0.6, 0.6],
    slideNumber: { x: 12.3, y: 7.0, w: 0.5, h: 0.3, fontFace: CORPO, fontSize: 10, color: COR.suave },
    objects: [
      { text: { text: 'REFRAMAX · Tempos & Métodos', options: { x: 0.6, y: 7.0, w: 6, h: 0.3, fontFace: CORPO, fontSize: 10, color: COR.suave, margin: 0 } } },
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.8, fontFace: CABECALHO, fontSize: 30, bold: true, color: COR.texto, align: 'left', valign: 'middle', margin: 0 }, text: '' } }
    ]
  });
  pptx.defineSlideMaster({
    title: 'FECHAMENTO',
    background: { color: COR.escuro },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.6, w: 12.1, h: 0.9, fontFace: CABECALHO, fontSize: 32, bold: true, color: COR.branco, align: 'left', margin: 0 }, text: '' } }
    ]
  });
}

/** Opções comuns dos gráficos — o mesmo visual em todos (novo objeto a cada chamada). */
const eixos = () => ({
  catAxisLabelColor: COR.suave,
  valAxisLabelColor: COR.suave,
  catAxisLabelFontFace: CORPO,
  valAxisLabelFontFace: CORPO,
  catAxisLabelFontSize: 11,
  valAxisLabelFontSize: 11,
  valGridLine: { color: COR.linha, size: 0.75 },
  catGridLine: { style: 'none' },
  catAxisLineShow: false,
  valAxisLineShow: false
});

function cartaoNumero(slide, { x, y, w, h, valor, rotulo, cor = COR.marca }) {
  slide.addShape('roundRect', { x, y, w, h, fill: { color: COR.cartao }, line: { color: COR.cartao }, rectRadius: 0.12, objectName: `cartao-${rotulo}` });
  slide.addText(valor, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: h * 0.55, fontFace: CABECALHO, fontSize: 34, bold: true, color: cor, margin: 0, valign: 'bottom', isTextBox: true });
  slide.addText(rotulo, { x: x + 0.25, y: y + h * 0.62, w: w - 0.5, h: h * 0.3, fontFace: CORPO, fontSize: 14, color: COR.suave, margin: 0, valign: 'top', isTextBox: true });
}

/** Monta todos os slides num objeto pptxgenjs já criado (testável fora do navegador). */
export function montarApresentacao(pptx, { lancamentos, periodo, filtros, projetos = [], achados = [], geradoEm = new Date() }) {
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = 'Relatório de Tempos e Métodos';
  pptx.author = 'REFRAMAX Tempos e Métodos';
  pptx.company = 'REFRAMAX';
  definirLayouts(pptx);

  const ind = calcularIndicadores(lancamentos);
  const total = ind.totalMin || 1;
  const va = ind.lean.VA / total;
  const principal = achados[0];

  // 1 — capa
  pptx.addSection({ title: 'Abertura' });
  const capa = pptx.addSlide({ masterName: 'CAPA', sectionTitle: 'Abertura' });
  capa.addText('Relatório de Tempos e Métodos', { placeholder: 'title' });
  capa.addText([
    { text: `Período: ${periodo}`, options: { breakLine: true } },
    { text: filtros, options: { breakLine: true } },
    { text: `Gerado em ${geradoEm.toLocaleDateString('pt-BR')}`, options: { fontSize: 14, color: '8E9BBD' } }
  ], { placeholder: 'body' });
  capa.addNotes('Relatório gerado automaticamente pelo app REFRAMAX Tempos & Métodos a partir dos apontamentos de campo.');

  // 2 — resumo
  pptx.addSection({ title: 'Indicadores' });
  const resumo = pptx.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Indicadores' });
  resumo.addText('Resumo do período', { placeholder: 'title' });
  const cards = [
    { valor: `${horas(ind.totalMin).toLocaleString('pt-BR')} h`, rotulo: `apontadas em ${ind.n} lançamentos` },
    { valor: pctTxt(ind.prodMin / total), rotulo: 'do tempo em atividades produtivas', cor: COR.VA },
    { valor: pctTxt(va), rotulo: 'foi Valor Agregado (Lean)', cor: va >= 0.5 ? COR.VA : COR.DN },
    { valor: pctTxt(ind.aderenciaTempo), rotulo: 'dos lançamentos dentro do tempo planejado' }
  ];
  cards.forEach((c, i) => cartaoNumero(resumo, { x: 0.6 + i * 3.08, y: 1.5, w: 2.85, h: 2.1, ...c }));
  resumo.addText('Principal ponto de atenção', { x: 0.6, y: 4.0, w: 12.1, h: 0.4, fontFace: CABECALHO, fontSize: 16, bold: true, color: COR.texto, margin: 0, isTextBox: true });
  resumo.addText(
    principal
      ? [
          { text: corta(principal.titulo, 110), options: { bold: true, fontSize: 22, color: NIVEL_COR[principal.nivel], breakLine: true } },
          { text: corta(principal.sugestao || principal.detalhe || '', 230), options: { color: COR.texto } }
        ]
      : [{ text: 'Nenhum ponto crítico encontrado pelo assistente no momento.', options: { color: COR.texto } }],
    { x: 0.6, y: 4.55, w: 12.1, h: 2.1, fontFace: CORPO, fontSize: 18, margin: 0, valign: 'top', paraSpaceAfter: 8, isTextBox: true }
  );
  resumo.addNotes(`Total apontado: ${formatMinutes(ind.totalMin)}. Produtivo: ${formatMinutes(ind.prodMin)}. Improdutivo: ${formatMinutes(ind.improdMin)}. Excedente sobre o planejado: ${formatMinutes(ind.excedenteMin)}.`);

  // 3 — Lean
  const lean = pptx.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Indicadores' });
  lean.addText('Como o tempo foi usado', { placeholder: 'title' });
  lean.addChart(pptx.ChartType.doughnut, [{ name: 'Lean', labels: ['Valor Agregado', 'Desperdício Necessário', 'Desperdício Não Necessário'], values: [horas(ind.lean.VA), horas(ind.lean.DN), horas(ind.lean.DNN)] }], {
    x: 0.6, y: 1.4, w: 5.6, h: 5.3, holeSize: 58, chartColors: [COR.VA, COR.DN, COR.DNN],
    showPercent: true, showValue: false, showLegend: false, dataLabelColor: COR.branco, dataLabelFontSize: 13, dataLabelFontFace: CORPO, dataBorder: { pt: 2, color: COR.branco }
  });
  const leanLinhas = [
    ['VA', 'Valor Agregado', 'o que transforma o serviço: aplicar, montar, assentar'],
    ['DN', 'Desperdício Necessário', 'preparações inevitáveis hoje: acesso, setup, excedente do planejado'],
    ['DNN', 'Desperdício Não Necessário', 'perdas evitáveis: esperas, falta de material, retrabalho']
  ];
  leanLinhas.forEach(([k, nome, desc], i) => {
    const y = 1.75 + i * 1.6;
    lean.addShape('ellipse', { x: 6.7, y: y + 0.08, w: 0.32, h: 0.32, fill: { color: COR[k] }, line: { color: COR[k] }, objectName: `lean-${k}` });
    lean.addText([
      { text: `${nome} · ${pctTxt(ind.lean[k] / total)}`, options: { bold: true, fontSize: 18, color: COR.texto, breakLine: true } },
      { text: `${formatMinutes(ind.lean[k])} — ${desc}`, options: { fontSize: 14, color: COR.suave } }
    ], { x: 7.2, y, w: 5.5, h: 1.3, fontFace: CORPO, margin: 0, valign: 'top', isTextBox: true });
  });
  lean.addNotes('Classificação Lean: o tempo que passou do planejado em uma atividade conta como Desperdício Necessário.');

  // 4 — tendência
  const serie = serieTemporal(ind.porDia);
  if (serie.length >= 2) {
    const tend = pptx.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Indicadores' });
    tend.addText('Produtivo × improdutivo ao longo do período', { placeholder: 'title' });
    tend.addChart(pptx.ChartType.bar, [
      { name: 'Produtivo', labels: serie.map((d) => d.label), values: serie.map((d) => horas(d.prod)) },
      { name: 'Improdutivo', labels: serie.map((d) => d.label), values: serie.map((d) => horas(d.improd)) }
    ], {
      x: 0.6, y: 1.35, w: 12.1, h: 5.4, barDir: 'col', barGrouping: 'stacked', barGapWidthPct: 60,
      chartColors: [COR.VA, COR.DNN], showLegend: true, legendPos: 't', legendFontFace: CORPO, legendFontSize: 12, legendColor: COR.texto,
      valAxisTitle: 'horas', showValAxisTitle: true, valAxisTitleColor: COR.suave, valAxisTitleFontSize: 11, ...eixos()
    });
    tend.addNotes('Horas apontadas por dia (ou por semana, em períodos longos), separando atividades produtivas de improdutividades.');
  }

  // 5 — improdutividades
  if (ind.topImprodutividades.length) {
    const top = ind.topImprodutividades.slice(0, 6);
    const imp = pptx.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Indicadores' });
    imp.addText('Onde a equipe mais ficou parada', { placeholder: 'title' });
    imp.addChart(pptx.ChartType.bar, [{ name: 'Horas', labels: top.map((t) => corta(t.label, 38)), values: top.map((t) => horas(t.value)) }], {
      x: 0.6, y: 1.35, w: 7.6, h: 5.4, barDir: 'bar', chartColors: [COR.DNN], catAxisOrientation: 'maxMin', valAxisHidden: true,
      showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.0" h"', dataLabelColor: COR.texto, dataLabelFontFace: CORPO, dataLabelFontSize: 12,
      showLegend: false, barGapWidthPct: 50, ...eixos(), valGridLine: { style: 'none' }
    });
    imp.addShape('roundRect', { x: 8.6, y: 1.5, w: 4.1, h: 5.0, fill: { color: COR.cartao }, line: { color: COR.cartao }, rectRadius: 0.12, objectName: 'acao-improdutividade' });
    imp.addText([
      { text: 'O que fazer com a maior causa', options: { bold: true, fontSize: 16, color: COR.texto, breakLine: true } },
      { text: corta(top[0].label, 60), options: { bold: true, fontSize: 14, color: COR.DNN, breakLine: true } },
      { text: contramedida(top[0].label), options: { fontSize: 14, color: COR.texto } }
    ], { x: 8.9, y: 1.8, w: 3.5, h: 4.4, fontFace: CORPO, margin: 0, valign: 'top', paraSpaceAfter: 10, isTextBox: true });
    imp.addNotes(`Improdutividades somadas no período. Maior causa: ${top[0].label} (${formatMinutes(top[0].value)}).`);
  }

  // 6 — planejado × real por projeto
  const porProjeto = planejadoRealPorProjeto(projetos, lancamentos).sort((a, b) => (b.desvio ?? 0) - (a.desvio ?? 0)).slice(0, 8);
  if (porProjeto.length) {
    pptx.addSection({ title: 'Planejamento' });
    const pj = pptx.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Planejamento' });
    pj.addText('Planejado × realizado por projeto', { placeholder: 'title' });
    const cab = ['Projeto', 'Contrato', 'Etapas iniciadas', 'Planejado', 'Realizado', 'Desvio'].map((t) => ({ text: t, options: { bold: true, color: COR.branco, fill: { color: COR.marca } } }));
    const linhas = porProjeto.map((x) => [
      { text: corta(x.projeto.nome, 40) },
      { text: corta(x.projeto.contratoNome || '', 22) },
      { text: `${x.iniciadas} de ${x.etapas}`, options: { align: 'center' } },
      { text: formatMinutes(x.planejadoMin), options: { align: 'right' } },
      { text: formatMinutes(x.realMin), options: { align: 'right' } },
      { text: x.desvio == null ? '—' : `${x.desvio > 0 ? '+' : ''}${Math.round(x.desvio * 100)}%`, options: { align: 'right', bold: true, color: x.desvio > 0.1 ? COR.DNN : x.desvio < -0.1 ? COR.VA : COR.texto } }
    ]);
    pj.addTable([cab, ...linhas], {
      x: 0.6, y: 1.45, w: 12.1, colW: [4.1, 2.4, 1.6, 1.3, 1.4, 1.3], fontFace: CORPO, fontSize: 13, color: COR.texto,
      border: { type: 'solid', pt: 0.75, color: COR.linha }, rowH: 0.5, valign: 'middle', autoPage: false
    });
    pj.addNotes('Cada lançamento é uma execução da etapa. Planejado = soma do tempo planejado das execuções já feitas; realizado = soma do tempo real delas.');
  }

  // 7 — atividades que passam do planejado
  if (ind.topExcedente.length >= 2) {
    const top = ind.topExcedente.slice(0, 6);
    const ex = pptx.addSlide({ masterName: 'CONTEUDO', sectionTitle: projetos.length ? 'Planejamento' : 'Indicadores' });
    ex.addText('Atividades que mais passam do planejado', { placeholder: 'title' });
    ex.addChart(pptx.ChartType.bar, [{ name: 'Excedente', labels: top.map((t) => corta(t.label, 45)), values: top.map((t) => horas(t.value)) }], {
      x: 0.6, y: 1.35, w: 12.1, h: 5.4, barDir: 'bar', chartColors: [COR.DN], catAxisOrientation: 'maxMin', valAxisHidden: true,
      showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.0" h"', dataLabelColor: COR.texto, dataLabelFontFace: CORPO, dataLabelFontSize: 12,
      showLegend: false, barGapWidthPct: 50, ...eixos(), valGridLine: { style: 'none' }
    });
    ex.addNotes('Soma do tempo que passou do planejado em cada atividade. É o primeiro lugar para fazer uma cronoanálise.');
  }

  // 8 — sugestões
  const sugestoes = achados.slice(0, 6);
  if (sugestoes.length) {
    pptx.addSection({ title: 'Melhorias' });
    const sg = pptx.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Melhorias' });
    sg.addText('Sugestões de melhoria', { placeholder: 'title' });
    sugestoes.forEach((a, i) => {
      const col = i % 3;
      const lin = Math.floor(i / 3);
      const x = 0.6 + col * 4.1;
      const y = 1.45 + lin * 2.75;
      sg.addShape('roundRect', { x, y, w: 3.85, h: 2.5, fill: { color: COR.cartao }, line: { color: COR.cartao }, rectRadius: 0.12, objectName: `sugestao-${i + 1}` });
      sg.addText([
        { text: `${NIVEIS[a.nivel].label.toUpperCase()} · ${a.area.toUpperCase()}`, options: { fontSize: 10, bold: true, color: NIVEL_COR[a.nivel], charSpacing: 1, breakLine: true } },
        { text: corta(a.titulo, 75), options: { fontSize: 14, bold: true, color: COR.texto, breakLine: true } },
        { text: corta(a.sugestao || a.detalhe || '', 140), options: { fontSize: 12, color: COR.suave } }
      ], { x: x + 0.22, y: y + 0.18, w: 3.4, h: 2.15, fontFace: CORPO, margin: 0, valign: 'top', paraSpaceAfter: 5, isTextBox: true });
    });
    sg.addNotes('Pontos levantados pelo assistente do app (regras de Tempos e Métodos e Lean). Detalhes na página Assistente.');
  }

  // 9 — próximos passos
  const passos = achados.filter((a) => a.sugestao).slice(0, 3);
  const passoAltura = 5.2 / Math.max(passos.length, 1);
  if (passos.length) {
    const fim = pptx.addSlide({ masterName: 'FECHAMENTO', sectionTitle: 'Melhorias' });
    fim.addText('Próximos passos', { placeholder: 'title' });
    passos.forEach((a, i) => {
      const y = 1.9 + i * Math.min(passoAltura, 1.75);
      fim.addShape('ellipse', { x: 0.6, y, w: 0.75, h: 0.75, fill: { color: COR.marca }, line: { color: COR.marca }, objectName: `passo-${i + 1}` });
      fim.addText(String(i + 1), { x: 0.6, y, w: 0.75, h: 0.75, fontFace: CABECALHO, fontSize: 22, bold: true, color: COR.branco, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
      fim.addText([
        { text: corta(a.titulo, 90), options: { bold: true, fontSize: 18, color: COR.branco, breakLine: true } },
        { text: corta(a.sugestao, 170), options: { fontSize: 14, color: 'C9D3EC' } }
      ], { x: 1.65, y: y - 0.05, w: 11.0, h: 1.4, fontFace: CORPO, margin: 0, valign: 'top', isTextBox: true });
    });
    fim.addNotes('Ações sugeridas a partir dos pontos de maior prioridade.');
  }

  return pptx;
}

/** Gera e baixa o arquivo .pptx (no navegador). */
export async function gerarRelatorioPptx(dados) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = montarApresentacao(new PptxGenJS(), dados);
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  await pptx.writeFile({ fileName: `reframax-relatorio-${stamp}.pptx` });
}
