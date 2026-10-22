import { el, mount } from '../../utils/dom.js';
import { badge, button, emptyState, segmented } from '../../components/ui.js';
import { icon } from '../../utils/icons.js';
import { navigate } from '../../router.js';
import { analisarPlanejamento, NIVEIS } from '../../lib/agentes.js';
import { updateProjeto } from '../../lib/projetos.js';
import { updateAtividade } from '../../lib/activities.js';
import { toast } from '../../lib/toast.js';

const CHAVE = 'rfx.agente.dispensados';

export function lerDispensados() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE) || '[]'));
  } catch {
    return new Set();
  }
}

function salvarDispensados(set) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify([...set].slice(-500)));
  } catch {
    /* sem armazenamento: dispensar vale só até recarregar */
  }
}

/** Achados ainda não dispensados — usado também para o número no menu e no dashboard. */
export function achadosAtivos(ctx) {
  const dispensados = lerDispensados();
  return analisarPlanejamento(ctx).filter((a) => !dispensados.has(a.id));
}

/** Executa a ação sugerida por um achado. Nada é alterado sem esse clique. */
export async function executarAcao(acao, ctx) {
  try {
    if (acao.tipo === 'abrir') return navigate(acao.page);
    if (acao.tipo === 'ajustarDuracaoEtapa' || acao.tipo === 'ajustarMODEtapa') {
      const p = ctx.projetos.find((x) => x.id === acao.projetoId);
      if (!p) return toast('Projeto não encontrado.', 'error');
      const patch = acao.tipo === 'ajustarDuracaoEtapa' ? { duracaoMin: acao.min } : { efetivo: acao.efetivo };
      await updateProjeto(p.id, { etapas: p.etapas.map((e) => (e.id === acao.etapaId ? { ...e, ...patch } : e)) });
      return toast('Planejamento atualizado.', 'ok');
    }
    if (acao.tipo === 'definirPadrao') {
      await updateAtividade(acao.atividadeId, { duracaoPadraoMin: acao.min });
      return toast('Tempo padrão definido.', 'ok');
    }
  } catch {
    toast('Não foi possível aplicar. Tente novamente.', 'error');
  }
}

/** Cartão de um achado — reaproveitado no dashboard. */
export function cartaoAchado(a, ctx, { aoDispensar } = {}) {
  const n = NIVEIS[a.nivel];
  return el('div', { class: `finding finding-${a.nivel}` }, [
    el('div', { class: 'finding-head' }, [badge(n.label, n.tone, true), el('span', { class: 'finding-area' }, a.area)]),
    el('strong', { class: 'finding-title' }, a.titulo),
    a.detalhe ? el('p', { class: 'finding-detail' }, a.detalhe) : null,
    a.sugestao ? el('div', { class: 'finding-tip' }, [el('span', { html: icon.lightbulb(15), style: { display: 'inline-flex', flexShrink: '0' } }), el('span', {}, a.sugestao)]) : null,
    a.acao || aoDispensar
      ? el('div', { class: 'toolbar' }, [
          a.acao ? button({ label: a.acao.label, size: 'sm', variant: a.acao.tipo === 'abrir' ? 'outline' : 'primary', onClick: () => executarAcao(a.acao, ctx) }) : null,
          aoDispensar ? button({ label: 'Dispensar', size: 'sm', variant: 'ghost', icon: icon.x(14), onClick: () => aoDispensar(a) }) : null
        ])
      : null
  ]);
}

export function renderAssistentePage(ctxInicial) {
  let ctx = ctxInicial;
  let filtro = 'todos';
  let verDispensados = false;
  const node = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '980px' } });

  function dispensar(a) {
    const set = lerDispensados();
    set.add(a.id);
    salvarDispensados(set);
    toast('Dispensado. Se o problema mudar, ele volta a aparecer.', 'info');
    paint();
  }

  function restaurar() {
    salvarDispensados(new Set());
    paint();
  }

  function paint() {
    const dispensados = lerDispensados();
    const todos = analisarPlanejamento(ctx);
    const visiveis = todos.filter((a) => (verDispensados ? dispensados.has(a.id) : !dispensados.has(a.id)));
    const lista = filtro === 'todos' ? visiveis : visiveis.filter((a) => a.nivel === filtro);
    const conta = (nivel) => visiveis.filter((a) => a.nivel === nivel).length;

    const tabs = segmented(
      [{ value: 'todos', label: `Todos (${visiveis.length})` }, ...Object.entries(NIVEIS).map(([k, v]) => ({ value: k, label: `${v.label} (${conta(k)})` }))],
      filtro,
      (v) => { filtro = v; paint(); }
    );

    mount(node, [
      el('div', { class: 'assist-hero' }, [
        el('span', { class: 'assist-hero-icon', html: icon.lightbulb(26) }),
        el('div', {}, [
          el('strong', {}, todos.length ? `${conta('critico')} crítico(s), ${conta('atencao')} de atenção e ${conta('oportunidade')} oportunidade(s)` : 'Tudo em ordem'),
          el('p', {}, 'O assistente revisa projetos, apontamentos, atividades e estudos sempre que os dados mudam. Ele só sugere — nada é alterado sem o seu clique.')
        ])
      ]),
      el('div', { class: 'toolbar', style: { justifyContent: 'space-between' } }, [
        tabs,
        el('div', { class: 'toolbar' }, [
          button({ label: verDispensados ? 'Ver ativos' : `Dispensados (${todos.filter((a) => dispensados.has(a.id)).length})`, size: 'sm', variant: 'ghost', onClick: () => { verDispensados = !verDispensados; paint(); } }),
          verDispensados && dispensados.size ? button({ label: 'Restaurar todos', size: 'sm', variant: 'outline', onClick: restaurar }) : null
        ])
      ]),
      lista.length
        ? el('div', { class: 'finding-list' }, lista.map((a) => cartaoAchado(a, ctx, { aoDispensar: verDispensados ? null : dispensar })))
        : emptyState({ icon: icon.check(36), title: verDispensados ? 'Nada dispensado' : 'Nenhum ponto nesta categoria', message: verDispensados ? '' : 'Quando surgir algo que mereça atenção, aparece aqui.' })
    ]);
  }

  paint();
  return {
    node,
    update(novo) {
      ctx = novo;
      paint();
    }
  };
}
