import { el, mount } from '../../utils/dom.js';
import { field, button } from '../../components/ui.js';
import { icon } from '../../utils/icons.js';
import { formatMinutes } from '../../utils/format.js';
import { CONFIANCAS, TOLERANCIAS, somaTolerancias, fatorTolerancia, pct, num } from '../../utils/estudos.js';
import { projetosAtivos, updateProjeto } from '../../lib/projetos.js';
import { updateAtividade } from '../../lib/activities.js';
import { toast } from '../../lib/toast.js';

/** Bloco de resultado: rótulo pequeno + número grande (+ legenda opcional). */
export function resultadoTile(label, valor, legenda, destaque = false) {
  return el('div', { class: `res-tile${destaque ? ' destaque' : ''}` }, [
    el('span', {}, label),
    el('strong', { class: 'mono' }, valor),
    legenda ? el('small', {}, legenda) : null
  ]);
}

export const resultadoGrid = (tiles) => el('div', { class: 'res-grid' }, tiles);

/** Linha de fórmula didática: "TC 40 s × FR 1,10 = TN 44 s". */
export function formula(partes) {
  return el('div', { class: 'formula' }, partes.map((p) => (typeof p === 'string' ? el('span', { class: 'op' }, p) : el('span', { class: 'term' }, [el('small', {}, p[0]), el('b', { class: 'mono' }, p[1])]))));
}

/** Botões grandes de escolha única (pensados para o dedo, com luva). */
export function escolhas({ opcoes, valor, aoEscolher, colunas = 1 }) {
  return el('div', { class: 'big-choices', style: { gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` } }, opcoes.map((o) =>
    el('button', { type: 'button', class: `big-choice${o.value === valor ? ' on' : ''}`, onclick: () => aoEscolher(o.value) }, [
      el('strong', {}, o.label),
      o.desc ? el('small', {}, o.desc) : null
    ])
  ));
}

export function inputNum(valor, aoMudar, props = {}) {
  return el('input', { class: 'input mono', type: 'number', inputmode: 'decimal', value: valor ?? '', onchange: (e) => aoMudar(e.target.value === '' ? '' : Number(e.target.value)), ...props });
}

export function inputTexto(valor, aoMudar, props = {}) {
  return el('input', { class: 'input', type: 'text', value: valor || '', oninput: (e) => aoMudar(e.target.value), ...props });
}

/**
 * Escolha do "alvo" do estudo: um projeto + etapa planejada, ou uma
 * atividade do catálogo (sem projeto). Escreve em `st.alvo`.
 */
export function alvoPicker(st, ctx, atualizar) {
  st.alvo = st.alvo || {};
  const a = st.alvo;
  const projetos = projetosAtivos(ctx.projetos || []);
  const projeto = projetos.find((p) => p.id === a.projetoId);

  const projSel = el('select', { class: 'select', onchange: (e) => {
    const p = projetos.find((x) => x.id === e.target.value);
    Object.assign(a, { projetoId: p?.id || '', projetoNome: p?.nome || '', contratoNome: p?.contratoNome || '', clienteNome: p?.clienteNome || '', etapaId: '', atividadeId: '', atividadeNome: '' });
    atualizar();
  } }, [
    el('option', { value: '' }, projetos.length ? 'Sem projeto (escolher do catálogo)' : 'Nenhum projeto aberto'),
    ...projetos.map((p) => el('option', { value: p.id, selected: p.id === a.projetoId }, `${p.nome} — ${p.contratoNome}`))
  ]);

  let itemSel;
  if (projeto) {
    itemSel = el('select', { class: 'select', onchange: (e) => {
      const et = (projeto.etapas || []).find((x) => x.id === e.target.value);
      Object.assign(a, { etapaId: et?.id || '', atividadeId: et?.atividadeId || '', atividadeNome: et?.nome || '' });
      atualizar();
    } }, [
      el('option', { value: '' }, 'Selecione a etapa…'),
      ...(projeto.etapas || []).map((e) => el('option', { value: e.id, selected: e.id === a.etapaId }, e.codigo ? `${e.codigo} — ${e.nome}` : e.nome))
    ]);
  } else {
    const produtivas = (ctx.atividades || []).filter((x) => x.tipo === 'produtiva' && x.ativo !== false);
    itemSel = el('select', { class: 'select', onchange: (e) => {
      const at = produtivas.find((x) => x.id === e.target.value);
      Object.assign(a, { etapaId: '', atividadeId: at?.id || '', atividadeNome: at?.nome || '', contratoNome: at?.contrato || '' });
      atualizar();
    } }, [
      el('option', { value: '' }, 'Selecione a atividade (opcional)…'),
      ...produtivas.map((x) => el('option', { value: x.id, selected: x.id === a.atividadeId }, x.codigo ? `${x.codigo} — ${x.nome}` : x.nome))
    ]);
  }

  return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
    field({ label: 'Projeto', input: projSel }),
    field({ label: projeto ? 'Etapa do projeto' : 'Atividade', input: itemSel })
  ]);
}

/** Texto curto do alvo para listas: "Etapa · Projeto". */
export function alvoTexto(alvo = {}) {
  return [alvo.atividadeNome, alvo.projetoNome].filter(Boolean).join(' · ') || 'Avulso';
}

/** Editor de tolerâncias (liga/desliga + %), mostrando p e FT ao vivo. */
export function toleranciasEditor(st, atualizar) {
  const sel = st.tolerancias;
  const total = el('div', { class: 'tol-total' });
  const pintarTotal = () => {
    const p = somaTolerancias(sel);
    mount(total, [formula([['Tolerância total (p)', pct(p, 1)], '→', ['FT = 1 ÷ (1 − p)', num(fatorTolerancia(p), 3)]])]);
  };
  const lista = el('div', { class: 'tol-list' }, TOLERANCIAS.map((t) => {
    const item = sel[t.key];
    const chk = el('input', { type: 'checkbox', checked: item.ativo, onchange: (e) => { item.ativo = e.target.checked; pintarTotal(); atualizar({ repintar: false }); } });
    const val = el('input', { class: 'input mono input-compact', type: 'number', min: '0', max: '30', step: '0.5', value: String(item.pct),
      onchange: (e) => { item.pct = Math.max(0, Number(e.target.value) || 0); pintarTotal(); atualizar({ repintar: false }); } });
    return el('label', { class: 'tol-item' }, [chk, el('span', {}, t.label), el('span', { class: 'tol-pct' }, [val, '%'])]);
  }));
  pintarTotal();
  return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, [lista, total]);
}

/** Seletores de confiança e margem de erro (estatística da amostra). */
export function precisaoEditor(st, atualizar, { erroLabel = 'Margem de erro aceita', erros = [0.03, 0.05, 0.1] } = {}) {
  return el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }, [
    field({ label: 'Confiança', input: el('select', { class: 'select', onchange: (e) => { st.confianca = Number(e.target.value); atualizar(); } },
      CONFIANCAS.map((c) => el('option', { value: c.value, selected: c.value === st.confianca }, c.label))) }),
    field({ label: erroLabel, input: el('select', { class: 'select', onchange: (e) => { st.erro = Number(e.target.value); atualizar(); } },
      erros.map((v) => el('option', { value: v, selected: v === st.erro }, `± ${pct(v)}`))) })
  ]);
}

/**
 * Ações do gestor sobre um resultado em minutos: gravar como duração
 * planejada da etapa do projeto e/ou como padrão da atividade no catálogo.
 */
export function acoesAplicar(estudo, ctx, minutos, rotulo = 'tempo da etapa') {
  if (!ctx.gestor || !(minutos > 0)) return null;
  const a = estudo.alvo || {};
  const min = Math.max(1, Math.round(minutos));
  const projeto = (ctx.projetos || []).find((p) => p.id === a.projetoId);
  const etapa = projeto?.etapas?.find((e) => e.id === a.etapaId);
  const atividade = (ctx.atividades || []).find((x) => x.id === a.atividadeId);
  const botoes = [];
  if (projeto && etapa) {
    botoes.push(button({ label: `Usar no projeto (${formatMinutes(min)})`, variant: 'primary', size: 'sm', icon: icon.target(14), onClick: async () => {
      try {
        await updateProjeto(projeto.id, { etapas: projeto.etapas.map((e) => (e.id === etapa.id ? { ...e, duracaoMin: min } : e)) });
        toast(`Duração planejada de "${etapa.nome}" atualizada para ${formatMinutes(min)}.`, 'ok');
      } catch {
        toast('Não foi possível atualizar o projeto.', 'error');
      }
    } }));
  }
  if (atividade) {
    botoes.push(button({ label: `Usar como padrão do catálogo`, variant: 'outline', size: 'sm', icon: icon.briefcase(14), onClick: async () => {
      try {
        await updateAtividade(atividade.id, { duracaoPadraoMin: min });
        toast(`Padrão de "${atividade.nome}" atualizado para ${formatMinutes(min)}.`, 'ok');
      } catch {
        toast('Não foi possível atualizar o catálogo.', 'error');
      }
    } }));
  }
  if (!botoes.length) return null;
  return el('div', { class: 'apply-box' }, [
    el('div', {}, [el('strong', {}, 'Levar este resultado para o planejamento'), el('small', {}, `Grava ${formatMinutes(min)} como ${rotulo}.`)]),
    el('div', { class: 'toolbar' }, botoes)
  ]);
}
