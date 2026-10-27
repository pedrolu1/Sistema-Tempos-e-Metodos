// Visão geral: indicadores, a bateria ao vivo, o feed e as curvas.
import { el } from '../../../../src/utils/dom.js';
import { legendaEtapas, statusChip } from '../../components/base.js';
import { mapaBateria } from '../../components/mapa.js';
import { feed } from '../../components/feed.js';
import { graficoCurvaS, graficoProducao } from '../../components/graficos.js';
import { abrirForno } from '../../components/detalheForno.js';
import { FORNOS, contratoAtivo } from '../../data/obra.js';
import { avancoFisico, idxsDaBateria, semanaAtual, curvaS, producaoDiaria, rdoDoDia, checklists } from '../../lib/calculo.js';
import { hoje, somarDias } from '../../lib/datas.js';

const pct = (v, casas = 1) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

export function paginaVisao({ calc, mudou, ir }) {
  const contrato = contratoAtivo();
  const bat = contrato.bateria;
  const fornosBat = FORNOS.filter((f) => f.bateria === bat);
  const concluidos = fornosBat.filter((f) => calc.fornos[f.id].concluidoEm).length;
  const fisico = avancoFisico(calc, idxsDaBateria(bat));
  const sem = semanaAtual(calc);
  const hj = hoje();
  const deHoje = calc.validos.filter((l) => l.data === hj);
  const pessoas = new Set(deHoje.map((l) => l.autor?.uid)).size;
  const pedidos = calc.estado.correcoes.filter((c) => c.status === 'pendente').length;
  const ckEnviados = Object.values(checklists(calc)).filter((c) => c.status === 'enviado').length;
  const curva = curvaS(calc);
  const ultimas4 = curva.pontos.filter((p) => p.realizado != null && p.previsto && !p.atual).slice(-4);
  const ader = ultimas4.length ? ultimas4.reduce((s, p) => s + p.realizado, 0) / ultimas4.reduce((s, p) => s + p.previsto, 0) : null;
  const rdo = rdoDoDia(calc, hj);

  const indicadores = el('div', { class: 'indicadores' }, [
    indicador('Avanço físico', pct(fisico), fisico, `pelas 6 etapas · bateria ${bat}`),
    indicador('Fornos concluídos', [String(concluidos), el('small', {}, `de ${fornosBat.length}`)], concluidos / fornosBat.length, `${pct(concluidos / fornosBat.length, 0)} do ${contrato.nome}`),
    indicador(`Semana ${sem.semana}`, [String(sem.fechados), el('small', {}, `de ${sem.meta}`)], sem.meta ? sem.fechados / sem.meta : 0, ader == null ? 'fornos fechados × meta' : `aderência das últimas 4 semanas: ${pct(ader, 0)}`, sem.meta && sem.fechados >= sem.meta ? 'bom' : ''),
    indicador('Lançado hoje', [String(deHoje.reduce((s, l) => s + l.prims.length, 0)), el('small', {}, 'etapas')], null, deHoje.length ? `${deHoje.length} lançamento${deHoje.length > 1 ? 's' : ''} de ${pessoas} pessoa${pessoas > 1 ? 's' : ''}` : 'nenhum lançamento ainda'),
    indicador('Pendências', String(pedidos + ckEnviados), null, pedidos + ckEnviados ? `${pedidos} correç${pedidos === 1 ? 'ão' : 'ões'} · ${ckEnviados} checklist${ckEnviados === 1 ? '' : 's'}` : 'nada esperando você', pedidos + ckEnviados ? 'alerta' : '')
  ]);

  const cartaoMapa = el('section', { class: 'cartao' }, [
    el('div', { class: 'cartao-topo' }, [
      el('div', {}, [el('h3', {}, `Bateria ${bat}`), el('p', {}, 'Cada quadrado é uma primária; a cor é a etapa mais avançada. Clique num forno.')]),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => ir('mapa') }, 'Abrir o mapa')
    ]),
    mapaBateria(calc, bat, { mudou, aoClicarForno: (fid) => abrirForno(fid) }),
    legendaEtapas()
  ]);
  const aoVivo = el('section', { class: 'cartao' }, [
    el('div', { class: 'cartao-topo' }, [el('h3', {}, 'Ao vivo'), el('span', { class: 'ao-vivo' }, 'tempo real')]),
    feed(calc.validos, { limite: 6, vazio: el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Sem lançamentos no app ainda'), 'Assim que o campo lançar, aparece aqui na hora.']) })
  ]);
  const cartaoRdo = el('section', { class: 'cartao' }, [
    el('div', { class: 'cartao-topo' }, [
      el('div', {}, [el('h3', {}, rdo.numero ? `RDO nº ${rdo.numero}` : 'RDO de hoje'), el('p', {}, `${rdo.atividades.reduce((s, a) => s + a.prims.length, 0)} etapas registradas hoje`)]),
      statusChip(rdo.status, { rascunho: 'Em preenchimento', fechado: 'Fechado', assinado: 'Assinado', planilha: 'Emitido na planilha' }[rdo.status])
    ]),
    el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => ir('rdo') }, 'Ver o RDO')
  ]);

  return [
    indicadores,
    cartaoMapa,
    el('div', { class: 'painel-grade' }, [
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Curva S'), el('p', {}, `${contrato.nome} · ${curva.escopo} fornos`)]), el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => ir('curva') }, 'Detalhes')]),
        graficoCurvaS(curva, { altura: 280 })
      ]),
      el('div', { class: 'pilha', style: { gap: '18px' } }, [aoVivo, cartaoRdo])
    ]),
    el('section', { class: 'cartao' }, [
      el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Produção por dia'), el('p', {}, 'Primárias por etapa, últimas 3 semanas. Passe o mouse para ver o dia.')]), legendaEtapas()]),
      graficoProducao(producaoDiaria(calc, somarDias(hj, -20), hj), { altura: 230 })
    ])
  ];
}

function indicador(rotulo, valor, fracao, texto, classe = '') {
  return el('div', { class: `indicador ${classe}` }, [
    el('span', {}, rotulo),
    el('div', { class: 'num' }, valor),
    fracao != null ? el('div', { class: 'barra' }, el('i', { style: { width: `${Math.min(100, fracao * 100)}%` } })) : null,
    el('p', {}, texto)
  ]);
}
