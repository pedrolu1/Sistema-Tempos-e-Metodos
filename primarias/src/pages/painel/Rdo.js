// RDO no painel: o relatório no formato do PLAN-RFX-002, montado pelos
// lançamentos e pelo que o apontador preencheu; o planejador fecha e imprime.
import { el } from '../../../../src/utils/dom.js';
import { statusChip } from '../../components/base.js';
import { ic } from '../../lib/icones.js';
import { CLIENTE, SERVICO, CODIGO_RDO, EFETIVO_MODELO, HORARIO } from '../../data/obra.js';
import { rdoDoDia } from '../../lib/calculo.js';
import { salvarRdo } from '../../lib/store.js';
import { hoje, somarDias, completa, nomeDia, semana, diaUtil } from '../../lib/datas.js';
import { toast } from '../../../../src/lib/toast.js';

let dia = null;
const STATUS = { rascunho: 'Em preenchimento', fechado: 'Fechado (digital)', assinado: 'Assinado (físico)', planilha: 'Emitido na planilha' };

export function paginaRdo(ctx) {
  const { calc, perfil, leitura } = ctx;
  dia ||= hoje();
  const r = rdoDoDia(calc, dia);
  const s = r.salvo || {};
  const ir = (d) => {
    dia = d;
    document.querySelector('.painel-pagina').replaceChildren(...paginaRdo(ctx));
  };
  const acoes = [];
  if (!leitura && r.status === 'rascunho') acoes.push(el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => { salvarRdo(dia, { status: 'fechado', numero: r.numero, fechadoPor: perfil.nome, fechadoEm: Date.now() }); toast(`RDO ${r.numero ? `nº ${r.numero} ` : ''}fechado. O campo não altera mais.`, 'ok'); } }, [el('span', { html: ic.lock(15) }), 'Fechar RDO']));
  if (!leitura && r.status === 'fechado') {
    acoes.push(el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => salvarRdo(dia, { status: 'rascunho', reabertoPor: perfil.nome }) }, 'Reabrir'));
    acoes.push(el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => { salvarRdo(dia, { status: 'assinado', assinadoEm: Date.now() }); toast('Marcado como assinado no papel.', 'ok'); } }, 'Marcar como assinado'));
  }
  acoes.push(el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => window.print() }, [el('span', { html: ic.imprimir(15) }), 'Imprimir ou salvar PDF']));

  return [
    el('div', { class: 'entre nao-imprimir', style: { flexWrap: 'wrap' } }, [
      el('div', { class: 'linha' }, [
        el('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': 'Dia anterior', html: ic.chevronLeft(18), onclick: () => ir(somarDias(dia, -1)) }),
        el('input', { class: 'input', type: 'date', value: dia, max: hoje(), style: { width: '170px', height: '38px' }, onchange: (ev) => ev.target.value && ir(ev.target.value) }),
        el('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': 'Próximo dia', disabled: dia >= hoje(), html: ic.chevronLeft(18), style: { transform: 'scaleX(-1)' }, onclick: () => ir(somarDias(dia, 1)) }),
        statusChip(r.status, STATUS[r.status])
      ]),
      el('div', { class: 'toolbar' }, acoes)
    ]),
    documento(r, s),
    leitura ? null : el('section', { class: 'cartao nao-imprimir' }, [
      el('h3', {}, 'Textos do relatório'),
      el('div', { class: 'rdo-edicao' }, [
        campoTexto('Observações (Reframax)', s.obs, r.status !== 'rascunho', (v) => salvarRdo(dia, { obs: v })),
        campoTexto('Observações da contratante', s.obsContratante, ['assinado', 'planilha'].includes(r.status), (v) => salvarRdo(dia, { obsContratante: v }))
      ])
    ]),
    controle(calc, ir)
  ];
}

function campoTexto(rotulo, valor, travado, aoSalvar) {
  return el('div', { class: 'field' }, [
    el('label', { class: 'field-label' }, rotulo),
    el('textarea', { class: 'textarea', rows: 4, disabled: travado, value: valor || '', onchange: (ev) => aoSalvar(ev.target.value) })
  ]);
}

function documento(r, s) {
  const efetivo = s.efetivo || {};
  const tabelaEfetivo = (titulo, lista, cabFuncao = 'Funções') => {
    const real = (f, p) => (r.salvo ? efetivo[f] ?? p : '');
    const subPrev = lista.reduce((t, [, p]) => t + p, 0);
    const subReal = r.salvo ? lista.reduce((t, [f, p]) => t + (efetivo[f] ?? p), 0) : '';
    return el('table', {}, [
      el('thead', {}, [
        el('tr', {}, [el('th', { colspan: 5, style: { textAlign: 'center' } }, titulo)]),
        el('tr', {}, [el('th', { rowspan: 2 }, cabFuncao), el('th', { colspan: 2, class: 'n' }, 'Diurno'), el('th', { colspan: 2, class: 'n' }, 'Noturno')]),
        el('tr', {}, ['Previsto', 'Realizado', 'Previsto', 'Realizado'].map((t) => el('th', { class: 'n' }, t)))
      ]),
      el('tbody', {}, [
        ...lista.map(([f, p]) => el('tr', {}, [el('td', {}, f), el('td', { class: 'n' }, String(p)), el('td', { class: 'n' }, String(real(f, p))), el('td', { class: 'n' }, '0'), el('td', { class: 'n' }, '0')])),
        el('tr', {}, [el('th', {}, 'Subtotal'), el('th', { class: 'n' }, String(subPrev)), el('th', { class: 'n' }, String(subReal)), el('th', { class: 'n' }, '0'), el('th', { class: 'n' }, '0')])
      ])
    ]);
  };
  const clima = s.clima?.diurno || 'estavel';
  return el('article', { class: 'rdo-doc' }, [
    el('div', { class: 'rdo-cab' }, [
      el('div', {}, el('dl', {}, [el('dt', {}, 'RDO nº:'), el('dd', {}, r.numero ? String(r.numero).padStart(3, '0') : '—'), el('dt', {}, 'Data:'), el('dd', {}, completa(r.data)), el('dt', {}, 'Dia da semana:'), el('dd', {}, nomeDia(r.data)), el('dt', {}, 'Semana:'), el('dd', {}, semana(r.data))])),
      el('div', { class: 'titulo' }, ['Relatório diário de obra', el('small', {}, 'Execução'), el('small', {}, `Cliente: ${CLIENTE}`), el('small', {}, `Serviço: ${SERVICO}`)]),
      el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' } }, CODIGO_RDO)
    ]),
    el('div', { class: 'rdo-corpo' }, [
      el('div', {}, [
        el('h4', {}, 'Registro das atividades · turno diurno'),
        r.atividades.length
          ? el('div', { class: 'rdo-atividades' }, r.atividades.map((a) => el('div', {}, [el('b', {}, [el('i', { style: { background: a.etapa.cor } }), `${a.etapa.curto} (${a.prims.length})`]), el('ul', {}, a.linhas.map((l) => el('li', {}, l.replaceAll(' · ', ' - '))))])))
          : el('p', { class: 'rdo-vazio' }, diaUtil(r.data) ? 'Nenhuma atividade lançada neste dia.' : 'Fim de semana, sem atividades.'),
        el('h4', { style: { marginTop: '14px' } }, 'Observações'),
        el('div', { class: 'rdo-obs' }, s.obs || '')
      ]),
      el('div', { class: 'pilha', style: { gap: '10px' } }, [
        tabelaEfetivo('Mão de obra indireta', EFETIVO_MODELO.moi),
        tabelaEfetivo('Mão de obra direta', EFETIVO_MODELO.mod),
        tabelaEfetivo('Equipamentos móveis', EFETIVO_MODELO.equipamentos, 'Descrição')
      ])
    ]),
    el('div', { class: 'rdo-rodape' }, [
      el('table', {}, [el('thead', {}, el('tr', {}, el('th', { colspan: 2 }, 'Horário'))), el('tbody', {}, HORARIO.map((h) => el('tr', {}, [el('td', {}, h.dias), el('td', {}, h.horas)])))]),
      el('table', {}, [
        el('thead', {}, el('tr', {}, [el('th', {}, 'Condições climáticas'), el('th', { class: 'n' }, 'Diurno'), el('th', { class: 'n' }, 'Noturno')])),
        el('tbody', {}, [
          el('tr', {}, [el('td', {}, 'Tempo estável'), el('td', { class: 'n marcado' }, clima === 'estavel' ? 'X' : ''), el('td', { class: 'n' }, '')]),
          el('tr', {}, [el('td', {}, 'Tempo chuvoso'), el('td', { class: 'n marcado' }, clima === 'chuvoso' ? 'X' : ''), el('td', { class: 'n' }, '')])
        ])
      ]),
      el('table', {}, [
        el('thead', {}, [el('tr', {}, el('th', { colspan: 5 }, 'Controle de produção')), el('tr', {}, ['Materiais', 'Un.', 'Anterior', 'Aplicado', 'Acumulado'].map((t, i) => el('th', { class: i ? 'n' : '' }, t)))]),
        el('tbody', {}, r.materiais.map((m) => el('tr', {}, [el('td', {}, m.nome), el('td', { class: 'n' }, m.unidade), el('td', { class: 'n' }, m.anterior.toLocaleString('pt-BR')), el('td', { class: 'n marcado' }, m.aplicado.toLocaleString('pt-BR')), el('td', { class: 'n' }, m.acumulado.toLocaleString('pt-BR'))])))
      ])
    ]),
    el('h4', { style: { marginTop: '14px' } }, 'Observações da contratante'),
    el('div', { class: 'rdo-obs' }, s.obsContratante || ''),
    el('div', { class: 'rdo-ass' }, [el('div', {}, 'Contratada (Reframax) · Planejamento'), el('div', {}, 'Contratada (Reframax) · Coordenação'), el('div', {}, 'Contratante (Ternium)')])
  ]);
}

/** Controle dos RDOs (como a aba CONTROLE da planilha): últimos 14 dias. */
function controle(calc, ir) {
  const dias = Array.from({ length: 14 }, (_, i) => somarDias(hoje(), -i));
  const prevTotal = [...EFETIVO_MODELO.moi, ...EFETIVO_MODELO.mod].reduce((s, [, p]) => s + p, 0);
  return el('section', { class: 'cartao nao-imprimir' }, [
    el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Controle de RDOs'), el('p', {}, 'Últimos 14 dias. Clique na linha para abrir.')])]),
    el('div', { class: 'table-wrap' }, el('table', { class: 'data-table tabela-compacta' }, [
      el('thead', {}, el('tr', {}, ['Nº', 'Data', 'Dia', 'Semana', 'Etapas lançadas', 'Efetivo previsto', 'Efetivo realizado', 'Situação'].map((t, i) => el('th', { class: [0, 4, 5, 6].includes(i) ? 'n' : '' }, t)))),
      el('tbody', {}, dias.map((d) => {
        const r = rdoDoDia(calc, d);
        const ef = r.salvo?.efetivo;
        const real = r.salvo ? [...EFETIVO_MODELO.moi, ...EFETIVO_MODELO.mod].reduce((s, [f, p]) => s + (ef?.[f] ?? p), 0) : null;
        return el('tr', { style: { cursor: 'pointer' }, onclick: () => ir(d) }, [
          el('td', { class: 'n strong' }, r.numero ? String(r.numero) : '—'),
          el('td', {}, completa(d)),
          el('td', {}, nomeDia(d)),
          el('td', {}, semana(d)),
          el('td', { class: 'n' }, String(r.atividades.reduce((s, a) => s + a.prims.length, 0))),
          el('td', { class: 'n' }, diaUtil(d) ? String(prevTotal) : '0'),
          el('td', { class: 'n' }, real == null ? '—' : String(real)),
          el('td', {}, diaUtil(d) || r.salvo ? statusChip(r.status, STATUS[r.status]) : el('span', { class: 'fraco' }, 'sem expediente'))
        ]);
      }))
    ]))
  ]);
}

