import { el, mount } from '../../utils/dom.js';
import { button, badge, emptyState, modal } from '../../components/ui.js';
import { wizard, rascunho } from '../../components/Wizard.js';
import { icon } from '../../utils/icons.js';
import { addEstudo, deleteEstudo } from '../../lib/estudos.js';
import { toast } from '../../lib/toast.js';
import { alvoTexto } from './comum.js';
import { cronoanaliseDef } from './Cronoanalise.js';
import { amostragemDef } from './Amostragem.js';
import { taktLeadDef } from './TaktLead.js';
import { historicoDef } from './Historico.js';
import { mtmDef } from './MTM.js';

export const TIPOS_ESTUDO = [cronoanaliseDef, amostragemDef, mtmDef, taktLeadDef, historicoDef];
const defDe = (tipo) => TIPOS_ESTUDO.find((t) => t.tipo === tipo);
const dataDe = (e) => new Date(e.criadoEmLocal || Date.now()).toLocaleDateString('pt-BR');

/**
 * Central de estudos, usada no painel (gestor: todos os tipos e todos os
 * estudos) e no app de campo (só os estudos feitos em campo, e só os seus).
 * ctx: { projetos, atividades, lancamentos, estudos, profile, gestor }
 */
export function renderEstudosPage(ctxInicial) {
  // objeto único e mutável: os assistentes abertos sempre enxergam os dados novos
  const ctx = { estudos: [], ...ctxInicial };
  const tipos = TIPOS_ESTUDO.filter((t) => ctx.gestor || t.campo);
  let view = { nome: 'home' };
  let wiz = null;
  const node = el('div', { class: 'estudos', style: { display: 'flex', flexDirection: 'column', gap: '20px' } });

  const chaveRascunho = (tipo) => `${tipo}.${ctx.profile.uid}`;

  function paint() {
    if (view.nome === 'wizard') return; // o assistente se redesenha sozinho
    if (view.nome === 'detalhe') {
      const estudo = ctx.estudos.find((e) => e.id === view.id);
      if (estudo) {
        view.esperando = false;
        return mount(node, renderDetalhe(estudo));
      }
      // recém-salvo: o retrato local chega em instantes
      if (view.esperando) return mount(node, [el('div', { class: 'muted', style: { padding: '40px 0', textAlign: 'center' } }, 'Salvando estudo…')]);
      view = { nome: 'home' };
    }
    mount(node, renderHome());
  }

  // ------------------------------------------------------------------ home
  function renderHome() {
    const cards = el('div', { class: 'study-types' }, tipos.map((def) => {
      const temRascunho = !!rascunho(chaveRascunho(def.tipo)).ler();
      return el('div', { class: 'study-type' }, [
        el('div', { class: 'study-type-head' }, [el('span', { class: 'study-type-icon', html: def.iconeHtml }), el('strong', {}, def.nome)]),
        el('p', {}, def.resumo),
        el('code', { class: 'mono' }, def.formula),
        el('div', { class: 'toolbar' }, temRascunho
          ? [
              button({ label: 'Continuar', variant: 'primary', size: 'sm', icon: icon.bolt(14), onClick: () => abrirWizard(def, true) }),
              button({ label: 'Começar do zero', variant: 'ghost', size: 'sm', onClick: () => abrirWizard(def, false) })
            ]
          : [button({ label: 'Começar', variant: 'primary', size: 'sm', icon: icon.plus(14), onClick: () => abrirWizard(def, false) })])
      ]);
    }));

    const lista = ctx.estudos.filter((e) => tipos.some((t) => t.tipo === e.tipo));
    return [
      el('div', {}, [el('div', { class: 'section-title', style: { marginBottom: '10px' } }, 'Novo estudo'), cards]),
      el('div', {}, [
        el('div', { class: 'section-title', style: { marginBottom: '10px' } }, ctx.gestor ? 'Estudos salvos' : 'Meus estudos'),
        lista.length
          ? el('div', { class: 'study-list' }, lista.map(itemLista))
          : emptyState({ icon: icon.target(34), title: 'Nenhum estudo salvo', message: 'Escolha um tipo acima — o assistente explica cada passo.' })
      ])
    ];
  }

  function itemLista(e) {
    const def = defDe(e.tipo);
    return el('button', { type: 'button', class: 'study-item', onclick: () => { view = { nome: 'detalhe', id: e.id }; paint(); } }, [
      el('span', { class: 'study-type-icon', html: def?.iconeHtml || icon.target(20) }),
      el('div', { class: 'study-item-main' }, [
        el('strong', {}, e.titulo || def?.nome),
        el('small', {}, [def?.nome, alvoTexto(e.alvo), dataDe(e), ctx.gestor ? e.criadoPorNome : null].filter(Boolean).join(' · '))
      ]),
      el('div', { class: 'study-item-res' }, [
        el('b', { class: 'mono' }, e.resultado?.principal || ''),
        e._sincronizado === false ? badge('aguardando sincronizar', 'warn') : null
      ])
    ]);
  }

  // --------------------------------------------------------------- wizard
  function abrirWizard(def, continuar) {
    const draft = rascunho(chaveRascunho(def.tipo));
    if (!continuar) draft.limpar();
    const estado = (continuar && draft.ler()) || def.estadoInicial(ctx);
    view = { nome: 'wizard' };
    wiz = wizard({
      titulo: def.nome,
      iconeHtml: def.iconeHtml,
      passos: def.passos(ctx),
      estado,
      rascunhoChave: chaveRascunho(def.tipo),
      aoSair: () => voltar(),
      aoConcluir: async (st) => {
        const dados = def.salvar(st, ctx);
        const id = await addEstudo({ tipo: def.tipo, ...dados, profile: ctx.profile });
        if (def.aposSalvar) await def.aposSalvar(st, ctx);
        toast('Estudo salvo! Ele sincroniza automaticamente.', 'ok');
        wiz = null;
        // o snapshot local chega logo em seguida; até lá a lista mostra o detalhe assim que ele existir
        view = { nome: 'detalhe', id, esperando: true };
        paint();
        setTimeout(() => {
          if (view.esperando && view.id === id) voltar();
        }, 5000);
      }
    });
    mount(node, [wiz.node]);
    window.scrollTo?.({ top: 0 });
  }

  function voltar() {
    wiz = null;
    view = { nome: 'home' };
    paint();
  }

  // -------------------------------------------------------------- detalhe
  function renderDetalhe(e) {
    const def = defDe(e.tipo);
    const podeExcluir = ctx.gestor || e.criadoPorUid === ctx.profile.uid;
    return [
      el('div', { class: 'page-header' }, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0' } }, [
          button({ iconOnly: true, variant: 'ghost', icon: icon.arrowLeft(18), onClick: voltar }),
          el('div', { style: { minWidth: '0' } }, [
            el('h2', {}, e.titulo || def?.nome),
            el('p', {}, [def?.nome, dataDe(e), e.criadoPorNome].filter(Boolean).join(' · '))
          ])
        ]),
        podeExcluir ? button({ label: 'Excluir', variant: 'danger', size: 'sm', icon: icon.trash(14), onClick: () => confirmarExclusao(e) }) : null
      ]),
      el('div', { class: 'card card-pad' }, [def ? def.detalhe(e, ctx) : el('p', {}, 'Tipo de estudo desconhecido.')])
    ];
  }

  function confirmarExclusao(e) {
    const close = () => backdrop.remove();
    const backdrop = modal({
      title: 'Excluir estudo?',
      body: [el('p', { style: { fontSize: '13.5px', color: 'var(--text-1)' } }, 'O estudo será apagado. Padrões já aplicados ao planejamento continuam como estão.')],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({ label: 'Excluir', variant: 'danger', onClick: async () => {
          close();
          try {
            await deleteEstudo(e.id);
            toast('Estudo excluído.', 'ok');
            voltar();
          } catch {
            toast('Não foi possível excluir.', 'error');
          }
        } })
      ],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  paint();

  return {
    node,
    update(novo) {
      Object.assign(ctx, novo);
      paint();
    },
    destruir() {
      wiz?.destruir();
    }
  };
}
