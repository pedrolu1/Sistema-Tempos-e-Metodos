// Documentos: os PDFs (mapa, Curva S, checklist com fotos, espelho da medição
// e RDO) e as planilhas de controle preenchidas pelo app. A planilha é
// escolhida uma vez e fica guardada neste aparelho; a cada clique o app
// devolve uma cópia atualizada, com fórmulas, gráficos e macros intactos.
import { el } from '../../../../src/utils/dom.js';
import { legendaEtapas, statusChip } from '../../components/base.js';
import { mapaBateria } from '../../components/mapa.js';
import { graficoCurvaBm, graficoBms } from '../../components/graficos.js';
import { abrirImpressao } from '../../components/impressao.js';
import { NOME_STATUS } from '../../components/checklistFotos.js';
import { ic } from '../../lib/icones.js';
import { ETAPAS_MAPA, CLIENTE, SERVICO, contratoAtivo, localMedicao, rotulo } from '../../data/obra.js';
import { curvaBm, bmsDoContrato, bmAtual, contagemPorEtapa, relacaoDoBm } from '../../lib/calculo.js';
import { lerModelo, guardarModelo } from '../../lib/modelos.js';
import { baixar, nomeAtualizado, pdfChecklists, TIPO_XLSX, TIPO_XLSM } from '../../lib/documentos.js';
import { hoje, completa, curta, nomeBm, rotuloBm, referenciaBm, periodoBm } from '../../lib/datas.js';
import { toast } from '../../../../src/lib/toast.js';

const MODELOS = {
  gestao: { chave: 'gestao-visual', nome: 'Gestão Visual', aceita: '.xlsx,.xlsm' },
  curva: { chave: 'curva-s', nome: 'Curva S', aceita: '.xlsm,.xlsx' },
  resumo: { chave: 'resumo-medicao', nome: 'Resumo da medição', aceita: '.xlsx,.xlsm' }
};
let modelos = null;
let bmEscolhido = null;
let gravarMeta = false;
const ocupado = new Set();
let ctxAtual = null;
const qtd = (n, nome) => `${n} ${nome}${n === 1 ? '' : 's'}`;

function redesenhar() {
  if (ctxAtual && location.hash.slice(2) === 'documentos') ctxAtual.redesenhar();
}

async function carregarModelos() {
  const lista = await Promise.all(Object.entries(MODELOS).map(async ([id, m]) => [id, await lerModelo(m.chave)]));
  modelos = Object.fromEntries(lista);
  redesenhar();
}

async function ocupar(id, tarefa) {
  if (ocupado.has(id)) return;
  ocupado.add(id);
  redesenhar();
  try {
    await tarefa();
  } catch (err) {
    console.error(err);
    toast(err?.message?.startsWith('Não achei') ? err.message : 'Não consegui gerar o arquivo. Confira se é a planilha certa.', 'error', 7000);
  } finally {
    ocupado.delete(id);
    redesenhar();
  }
}

function escolherArquivo(tipo, depois) {
  const m = MODELOS[tipo];
  const entrada = el('input', {
    type: 'file', accept: m.aceita, style: { display: 'none' },
    onchange: async (ev) => {
      const arq = ev.target.files[0];
      entrada.remove();
      if (!arq) return;
      modelos = { ...(modelos || {}), [tipo]: await guardarModelo(m.chave, arq) };
      toast(`${m.nome}: planilha guardada neste aparelho.`, 'ok');
      redesenhar();
      depois?.();
    }
  });
  document.body.appendChild(entrada);
  entrada.click();
}

async function gerarExcel(tipo, calc) {
  const modelo = modelos?.[tipo];
  if (!modelo) return escolherArquivo(tipo, () => gerarExcel(tipo, calc));
  await ocupar(`excel-${tipo}`, async () => {
    const P = await import('../../lib/planilhas.js');
    let r;
    let msg;
    if (tipo === 'gestao') {
      r = P.atualizarGestaoVisual(modelo.bytes, calc);
      msg = r.resumo.celulas ? `Gestão Visual atualizada: ${r.resumo.primarias} primárias mudaram.` : 'Gestão Visual já estava em dia; só a data de atualização mudou.';
    } else if (tipo === 'curva') {
      r = P.atualizarCurvaS(modelo.bytes, calc, { gravarMeta });
      msg = `Curva S atualizada: ${r.resumo.realizado} fornos revestidos até hoje${r.resumo.metas ? `, meta gravada em ${r.resumo.metas} semanas` : ''}.`;
    } else {
      r = P.gerarEspelho(modelo.bytes, calc, bmEscolhido);
      msg = `${r.resumo.nova ? 'Aba nova' : 'Aba atualizada'}: "${r.resumo.aba}", ${r.resumo.fornos} fornos${r.resumo.foraDoLimite ? ` (${r.resumo.foraDoLimite} não couberam)` : ''}.`;
    }
    baixar(r.bytes, nomeAtualizado(modelo.nome), /\.xlsm$/i.test(modelo.nome) ? TIPO_XLSM : TIPO_XLSX);
    toast(msg, 'ok', 6000);
  });
}

export function paginaDocumentos(ctx) {
  ctxAtual = ctx;
  const { calc, ir } = ctx;
  if (modelos === null) {
    modelos = {};
    carregarModelos();
  }
  const atual = bmAtual();
  const bms = bmsDoContrato(calc);
  if (!bmEscolhido || !bms.some((b) => b.bm === bmEscolhido)) bmEscolhido = atual;
  const rel = relacaoDoBm(calc, bmEscolhido);

  const seletor = el('div', { class: 'pilha', style: { gap: '8px' } }, [
    el('div', { class: 'fraco', style: { fontSize: '13px' } }, 'Boletim de medição usado na Curva S, no checklist e no espelho:'),
    el('div', { class: 'blocos-trilho', role: 'tablist', 'aria-label': 'Boletim de medição' }, bms.map((b) => el('button', {
      type: 'button', role: 'tab', 'aria-selected': String(b.bm === bmEscolhido), class: `bloco-op${b.bm === bmEscolhido ? ' ativo' : ''}`,
      onclick: () => { bmEscolhido = b.bm; redesenhar(); }
    }, [`BM ${rotuloBm(b.bm)}`, el('small', {}, qtd(b.realizado, 'forno'))])))
  ]);

  const excel = (tipo, extra = null) => {
    const m = MODELOS[tipo];
    const modelo = modelos?.[tipo];
    const gerando = ocupado.has(`excel-${tipo}`);
    return el('div', { class: 'doc-excel' }, [
      el('div', { class: 'doc-excel-info' }, [
        el('span', { class: 'doc-excel-icone', html: ic.planilha(20) }),
        el('div', {}, [
          el('strong', {}, `Planilha ${m.nome}`),
          el('small', {}, modelo ? `${modelo.nome} · guardada ${new Date(modelo.salvoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'Escolha o arquivo uma vez; ele fica guardado neste aparelho.')
        ])
      ]),
      extra,
      el('div', { class: 'toolbar' }, [
        el('button', { class: 'btn btn-primary btn-sm', type: 'button', disabled: gerando, onclick: () => gerarExcel(tipo, calc) }, [el('span', { html: gerando ? '' : ic.download(15), class: gerando ? 'spinner' : '', style: { display: 'inline-flex' } }), gerando ? 'Gerando…' : modelo ? 'Baixar preenchida' : 'Escolher a planilha']),
        modelo ? el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => escolherArquivo(tipo) }, 'Trocar arquivo') : null
      ])
    ]);
  };

  const cartao = (icone, titulo, texto, corpo) => el('section', { class: 'cartao doc-cartao' }, [
    el('div', { class: 'cartao-topo' }, [el('div', { class: 'linha', style: { alignItems: 'flex-start' } }, [el('span', { class: 'doc-icone', html: icone }), el('div', {}, [el('h3', {}, titulo), el('p', {}, texto)])])]),
    ...corpo
  ]);
  const botaoPdf = (rotulo, fn, id = null) => {
    const gerando = id && ocupado.has(id);
    return el('button', { class: 'btn btn-outline btn-sm', type: 'button', disabled: gerando, onclick: fn }, [el('span', { html: gerando ? '' : ic.imprimir(15), class: gerando ? 'spinner' : '', style: { display: 'inline-flex' } }), gerando ? 'Gerando…' : rotulo]);
  };

  const c = curvaBm(calc, bmEscolhido);
  const comFotos = rel.filter((r) => r.checklist && r.checklist.origem !== 'planilha');

  return [
    seletor,
    el('div', { class: 'painel-grade doc-grade' }, [
      cartao(ic.mapa(22), 'Mapa visual', `Bateria ${contratoAtivo().bateria} com andaime, demolição, assentamento e revestimento de cada primária.`, [
        el('div', { class: 'toolbar' }, [botaoPdf('PDF do mapa', () => imprimirMapa(calc))]),
        excel('gestao')
      ]),
      cartao(ic.curva(22), `Curva S · BM ${rotuloBm(bmEscolhido)}`, `${c.realizado} de ${c.meta} fornos revestidos (${nomeBm(bmEscolhido)}).`, [
        el('div', { class: 'toolbar' }, [botaoPdf('PDF da Curva S', () => imprimirCurva(calc, bmEscolhido))]),
        excel('curva', el('label', { class: 'doc-opcao' }, [
          el('input', { type: 'checkbox', checked: gravarMeta, onchange: (ev) => { gravarMeta = ev.target.checked; } }),
          el('span', {}, `Também gravar a meta do app (${c.meta} por BM) no previsto, do BM atual em diante`)
        ]))
      ]),
      cartao(ic.camera(22), 'Checklist de entrega', `${qtd(rel.length, 'forno')} no BM ${rotuloBm(bmEscolhido)}; ${comFotos.length} com fotos no app.`, [
        el('div', { class: 'toolbar' }, [
          botaoPdf(`PDF do BM (${qtd(comFotos.length, 'forno')})`, () => comFotos.length ? ocupar('pdf-bm', async () => {
            const r = await pdfChecklists(comFotos, { reduzido: true });
            baixar(r.blob, `Checklists BM ${rotuloBm(bmEscolhido).replace('/', ' ')}.pdf`, 'application/pdf');
          }) : toast('Nenhum forno deste BM tem fotos no app.', 'info'), 'pdf-bm')
        ]),
        rel.length
          ? el('div', { class: 'doc-lista' }, rel.map((r) => el('div', { class: 'doc-linha' }, [
              el('span', { class: 'strong' }, rotulo(r.fid)),
              el('span', { class: 'fraco' }, r.checklist?.numero ? `nº ${r.checklist.numero}` : 'sem nº'),
              statusChip(r.checklist?.status || 'pendente', r.checklist?.origem === 'planilha' ? 'Planilha' : NOME_STATUS[r.checklist?.status || 'pendente']),
              r.checklist && r.checklist.origem !== 'planilha'
                ? botaoPdf('PDF', () => ocupar(`pdf-${r.fid}`, async () => {
                    const x = await pdfChecklists([r]);
                    baixar(x.blob, `Checklist ${r.fid}${r.checklist?.numero ? ` n${r.checklist.numero}` : ''}.pdf`, 'application/pdf');
                  }), `pdf-${r.fid}`)
                : el('span')
            ])))
          : el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Nenhum forno fechado neste BM'), 'Quando a última massa 1200 de um forno for lançada, ele entra aqui.'])
      ]),
      cartao(ic.documento(22), `Espelho da medição · BM ${rotuloBm(bmEscolhido)}`, 'Relação dos fornos reparados no período, com o nº e o status do checklist (o resumo enviado à Ternium).', [
        el('div', { class: 'toolbar' }, [botaoPdf('PDF do espelho', () => imprimirEspelho(calc, bmEscolhido))]),
        excel('resumo')
      ]),
      cartao(ic.diario(22), 'RDO', 'Relatório diário de obra no modelo PLAN-RFX-002, montado pelos lançamentos e pelo diário do campo.', [
        el('div', { class: 'toolbar' }, [el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: () => ir('rdo') }, [el('span', { html: ic.diario(15), style: { display: 'inline-flex' } }), 'Abrir o RDO do dia'])])
      ])
    ])
  ];
}

// ---------------------------------------------------------------------------
// Folhas para imprimir ou salvar em PDF
// ---------------------------------------------------------------------------
function imprimirMapa(calc) {
  const bat = contratoAtivo().bateria;
  const cont = contagemPorEtapa(calc, bat);
  const total = cont.reduce((s, n) => s + n, 0);
  abrirImpressao({
    titulo: `Mapa visual · Bateria ${bat}`,
    subtitulo: `${contratoAtivo().nome} · situação em ${completa(hoje())}`,
    paisagem: true,
    conteudo: [
      legendaEtapas(),
      mapaBateria(calc, bat, { grande: true }),
      el('table', { class: 'doc-tabela' }, [
        el('thead', {}, el('tr', {}, [el('th', {}, 'Situação (etapa mais avançada)'), el('th', { class: 'n' }, 'Primárias'), el('th', { class: 'n' }, '%')])),
        el('tbody', {}, [
          el('tr', {}, [el('td', {}, 'Pendente'), el('td', { class: 'n' }, String(cont[0])), el('td', { class: 'n' }, `${Math.round((cont[0] / total) * 100)}%`)]),
          ...ETAPAS_MAPA.map((e, i) => el('tr', {}, [el('td', {}, e.nome), el('td', { class: 'n' }, String(cont[i + 1])), el('td', { class: 'n' }, `${Math.round((cont[i + 1] / total) * 100)}%`)]))
        ])
      ])
    ]
  });
}

function imprimirCurva(calc, bmId) {
  const c = curvaBm(calc, bmId);
  const bms = bmsDoContrato(calc).map((b) => ({ ...b, rotulo: rotuloBm(b.bm), atual: b.bm === bmAtual() }));
  abrirImpressao({
    titulo: `Curva S de revestimento · BM ${rotuloBm(bmId)}`,
    subtitulo: `${nomeBm(bmId)} · meta de ${c.meta} fornos · ${c.realizado} revestidos · situação em ${completa(hoje())}`,
    paisagem: true,
    conteudo: [
      graficoCurvaBm(c, { altura: 330 }),
      el('table', { class: 'doc-tabela' }, [
        el('thead', {}, el('tr', {}, ['Semana', 'Período', 'Meta', 'Revestidos', 'Meta acum.', 'Realizado acum.', 'Fornos'].map((t, i) => el('th', { class: i >= 2 && i <= 5 ? 'n' : '' }, t)))),
        el('tbody', {}, c.pontos.map((p) => el('tr', { class: p.atual ? 'atual' : '' }, [
          el('td', {}, p.semana),
          el('td', {}, `${curta(p.ini)} a ${curta(p.fim)}`),
          el('td', { class: 'n' }, String(p.meta)),
          el('td', { class: 'n' }, p.realizado == null ? '' : String(p.realizado)),
          el('td', { class: 'n' }, String(p.metaAcum)),
          el('td', { class: 'n' }, p.realizadoAcum == null ? '' : String(p.realizadoAcum)),
          el('td', {}, p.fornos.map((f) => f.replace('-', ' ')).join(', '))
        ])))
      ]),
      el('h2', {}, 'Fornos revestidos por BM'),
      graficoBms(bms, { altura: 200 })
    ]
  });
}

function imprimirEspelho(calc, bmId) {
  const itens = relacaoDoBm(calc, bmId);
  const { inicio, fim } = periodoBm(bmId);
  const linha = (it, i) => el('tr', {}, [
    el('td', { class: 'n' }, String(i + 1)),
    el('td', { class: 'n' }, it.checklist?.numero ? String(it.checklist.numero) : ''),
    el('td', {}, localMedicao(it.fid)),
    el('td', {}, it.checklist?.status === 'aprovado' ? 'APROVADO' : 'PENDENTE')
  ]);
  const tabela = (lista, ini) => el('table', { class: 'doc-tabela' }, [
    el('thead', {}, el('tr', {}, ['Item', 'Nº do checklist', 'Localização', 'Status do checklist'].map((t, i) => el('th', { class: i < 2 ? 'n' : '' }, t)))),
    el('tbody', {}, lista.map((it, k) => linha(it, ini + k)))
  ]);
  const metade = Math.ceil(itens.length / 2);
  abrirImpressao({
    titulo: 'Relatório do serviço de substituição das primárias',
    subtitulo: 'e revestimento das abóbadas dos fornos da coqueria',
    conteudo: [
      el('dl', { class: 'doc-dados' }, [
        el('dt', {}, 'Contratante:'), el('dd', {}, CLIENTE),
        el('dt', {}, 'Contratada:'), el('dd', {}, 'Reframax Engenharia Ltda.'),
        el('dt', {}, 'Contrato:'), el('dd', {}, SERVICO),
        el('dt', {}, 'Período:'), el('dd', {}, `${completa(inicio)} a ${completa(fim)}`),
        el('dt', {}, 'Mês de referência:'), el('dd', {}, referenciaBm(bmId))
      ]),
      el('h2', {}, 'Relação dos fornos reparados no período de medição'),
      itens.length
        ? el('div', { class: 'doc-colunas' }, [tabela(itens.slice(0, metade), 0), tabela(itens.slice(metade), metade)])
        : el('p', {}, 'Nenhum forno concluído neste período.'),
      el('div', { class: 'doc-totais' }, [el('span', {}, ['Total geral (fornos): ', el('b', {}, String(itens.length))])]),
      el('div', { class: 'doc-ass' }, [el('div', {}, 'Contratada (Reframax) · data, assinatura e carimbo'), el('div', {}, 'Contratante (Ternium) · data, assinatura e carimbo')])
    ]
  });
}
