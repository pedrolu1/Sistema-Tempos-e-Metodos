// Hoje: a meta da semana, a temperatura da pessoa, a frente de serviço com a
// próxima etapa a um toque e o que a equipe está lançando agora.
import { el } from '../../../../src/utils/dom.js';
import { anel, seis, statusChip } from '../../components/base.js';
import { feed } from '../../components/feed.js';
import { abrirPedidoCorrecao } from '../../components/correcao.js';
import { iconeEtapa, ic } from '../../lib/icones.js';
import { ETAPAS, FORNOS, contratoAtivo, etapaPorId, noMeio } from '../../data/obra.js';
import { semanaAtual, alvosDoForno, resumoAlvos, NIVEL_MAX } from '../../lib/calculo.js';
import { hoje, porExtenso } from '../../lib/datas.js';

export function paginaHoje({ calc, perfil, stats, lancar, ir }) {
  const bat = contratoAtivo().bateria;
  const sem = semanaAtual(calc);
  const fornosBat = FORNOS.filter((f) => f.bateria === bat);
  const concluidos = fornosBat.filter((f) => calc.fornos[f.id].concluidoEm).length;
  const bateu = sem.meta > 0 && sem.fechados >= sem.meta;
  const hj = hoje();
  const equipeHoje = calc.validos.filter((l) => l.data === hj).reduce((s, l) => s + l.prims.length, 0);

  const hero = el('section', { class: 'semana-hero' }, [
    anel({ fracao: sem.meta ? sem.fechados / sem.meta : 0, chave: 'semana', centro: [el('span', { class: 'num' }, String(sem.fechados)), el('small', {}, `de ${sem.meta} fornos`)] }),
    el('div', {}, [
      el('h2', {}, `Semana ${sem.semana.replace('S-', '')}`),
      el('p', {}, bateu ? [el('span', { class: 'meta-ok' }, 'Meta da semana batida. '), 'Cada forno a mais é saldo.'] : sem.meta ? `Faltam ${sem.meta - sem.fechados} forno${sem.meta - sem.fechados > 1 ? 's' : ''} para a meta da semana.` : 'Sem meta prevista nesta semana.'),
      el('p', { class: 'fraco', style: { fontSize: '13px' } }, `Bateria ${bat}: ${concluidos} de ${fornosBat.length} fornos concluídos`)
    ])
  ]);

  const termometro = el('button', { class: 'termometro', type: 'button', onclick: () => ir('perfil') }, [
    el('div', { class: 'termometro-topo' }, [
      el('strong', {}, `${stats.graus} °C`),
      el('span', {}, stats.nivel >= NIVEL_MAX ? 'Temperatura máxima' : `faltam ${stats.ate - stats.xp} XP para ${stats.graus + 100} °C`)
    ]),
    el('div', { class: 'termometro-barra' }, el('i', { style: { width: `${Math.round(stats.fracao * 100)}%` } })),
    el('div', { class: 'termometro-escala' }, [el('span', {}, `${stats.graus} °C`), el('span', {}, '1200 °C')])
  ]);

  const numeros = el('div', { class: 'dia-numeros' }, [
    el('div', {}, [el('span', { class: 'num' }, String(stats.hojeEtapas)), el('small', {}, 'suas etapas hoje')]),
    el('div', {}, [el('span', { class: 'num' }, String(equipeHoje)), el('small', {}, 'equipe hoje')]),
    el('div', {}, [el('span', { class: 'num' }, String(stats.sequencia)), el('small', {}, stats.sequencia === 1 ? 'dia seguido' : 'dias seguidos')])
  ]);

  return [
    el('p', { class: 'fraco', style: { fontSize: '14px', marginBottom: '-6px' } }, `Bom trabalho, ${perfil.nome}. Hoje é ${porExtenso(hj)}.`),
    hero,
    termometro,
    numeros,
    frente(calc, fornosBat, lancar),
    el('section', { class: 'pilha' }, [
      el('div', { class: 'titulo-secao' }, ['Ao vivo na bateria', el('span', { class: 'ao-vivo' }, 'tempo real')]),
      feed(calc.validos, {
        vazio: el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Ninguém lançou ainda'), 'O primeiro lançamento do dia acende o mapa para toda a equipe.', el('button', { class: 'btn btn-primary', type: 'button', onclick: () => lancar() }, 'Lançar agora')])
      })
    ]),
    meusLancamentos(calc, perfil)
  ];
}

/** Fornos com serviço começado e ainda não concluídos, com a próxima etapa pronta para lançar. */
function frente(calc, fornosBat, lancar) {
  const abertos = fornosBat
    .filter((f) => !calc.fornos[f.id].concluidoEm && calc.fornos[f.id].niveis.some((n) => n >= 0))
    .map((f) => ({ f, soma: calc.fornos[f.id].niveis.reduce((s, n) => s + n + 1, 0) }))
    .sort((a, b) => b.soma - a.soma || a.f.id.localeCompare(b.f.id));
  let lista = abertos.slice(0, 4).map((x) => x.f);
  let titulo = 'Na frente de serviço';
  if (!lista.length) {
    lista = fornosBat.filter((f) => !calc.fornos[f.id].concluidoEm).slice(0, 3);
    titulo = 'Próximos fornos';
  }
  if (!lista.length) return null;
  return el('section', { class: 'pilha' }, [
    el('div', { class: 'titulo-secao' }, [titulo, el('small', {}, abertos.length > 4 ? `${abertos.length} fornos abertos` : '')]),
    el('div', { class: 'frente' }, lista.map((f) => {
      const proxima = ETAPAS.find((e) => alvosDoForno(calc, e.id, f.id).some((a) => a.ok));
      const prontas = calc.fornos[f.id].niveis.filter((n) => n === ETAPAS.length - 1).length;
      const faltam = calc.fornos[f.id].niveis.reduce((s, n) => s + (ETAPAS.length - 1 - n), 0);
      return el('div', { class: 'forno-linha' }, [
        el('div', { class: 'nome' }, [`F${String(f.forno).padStart(2, '0')}`, el('small', {}, `bloco ${f.bloco}`)]),
        seis(calc, f.id),
        el('div', { class: 'rodape' }, [
          el('span', {}, prontas ? `${prontas} de 6 prontas · faltam ${faltam} etapas` : `faltam ${faltam} etapas para fechar`),
          proxima ? el('button', { class: `proxima cor-${proxima.id}`, type: 'button', onclick: () => lancar(proxima.id, f.id) }, [el('span', { html: iconeEtapa(proxima.id, 16), style: { display: 'inline-flex', color: 'var(--cor)' } }), `Lançar ${noMeio(proxima)}`]) : null
        ])
      ]);
    }))
  ]);
}

function meusLancamentos(calc, perfil) {
  const hj = hoje();
  const meus = calc.estado.lancamentos.filter((l) => l.autor?.uid === perfil.uid && (l.data === hj || l.criadoEm > Date.now() - 36 * 3600 * 1000)).sort((a, b) => b.criadoEm - a.criadoEm);
  if (!meus.length) return null;
  const pedidos = calc.estado.correcoes;
  return el('section', { class: 'pilha' }, [
    el('div', { class: 'titulo-secao' }, ['Meus lançamentos', el('small', {}, 'só o planejador altera')]),
    el('div', { class: 'card card-pad', style: { padding: '4px 14px' } }, meus.slice(0, 8).map((l) => {
      const e = etapaPorId[l.etapa];
      const pedido = pedidos.filter((c) => c.lancId === l.id).pop();
      let estado = null;
      if (l.status === 'cancelado') estado = el('span', { class: 'estado estado-cancelado' }, 'Apagado pelo planejador');
      else if (pedido?.status === 'pendente') estado = statusChip('pendente', 'Correção pedida');
      else if (pedido?.status === 'recusada') estado = el('span', { class: 'estado fraco', title: pedido.resposta }, 'Pedido recusado');
      return el('div', { class: 'meu-lanc' }, [
        el('div', {}, [
          el('span', { class: `etiqueta-etapa cor-${e.id}` }, [el('span', { class: 'ponto' }), `${e.curto} · ${l.prims.length}`]),
          el('div', { class: 'alvos' }, resumoAlvos(l.prims, l.etapa).join(', '))
        ]),
        estado || el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => abrirPedidoCorrecao(l, perfil) }, [el('span', { html: ic.pedido(15) }), 'Corrigir'])
      ]);
    }))
  ]);
}
