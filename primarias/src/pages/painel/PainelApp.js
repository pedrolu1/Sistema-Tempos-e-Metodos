// Painel do planejador, do administrador e do gestor (este só olha).
import { el, mount } from '../../../../src/utils/dom.js';
import { credito } from '../../../../src/components/ui.js';
import { initials } from '../../../../src/utils/format.js';
import { ic } from '../../lib/icones.js';
import { assinar } from '../../lib/store.js';
import { calcular, checklists } from '../../lib/calculo.js';
import { PAPEIS } from '../../data/obra.js';
import { somenteLeitura } from '../../lib/sessao.js';
import { paginaVisao } from './Visao.js';
import { paginaMapa } from './Mapa.js';
import { paginaCurva } from './Curva.js';
import { paginaRdo } from './Rdo.js';
import { paginaChecklists } from './Checklists.js';
import { paginaLancamentos } from './Lancamentos.js';
import { paginaAprovacoes } from './Aprovacoes.js';
import { paginaDesvios } from './Desvios.js';
import { paginaConfig } from './Config.js';

const NAV = [
  { id: 'visao', nome: 'Visão geral', icone: ic.grid(18), sub: 'Bateria em tempo real', pagina: paginaVisao },
  { id: 'mapa', nome: 'Mapa visual', icone: ic.mapa(18), sub: 'Cada primária, na posição da bateria', pagina: paginaMapa },
  { id: 'curva', nome: 'Curva S', icone: ic.curva(18), sub: 'Previsto, realizado e avanço físico por etapa', pagina: paginaCurva },
  { id: 'rdo', nome: 'RDO', icone: ic.diario(18), sub: 'Relatório diário de obra, montado pelos lançamentos', pagina: paginaRdo },
  { id: 'checklists', nome: 'Checklists', icone: ic.prancheta(18), sub: 'Entrega dos fornos e relação para a medição', pagina: paginaChecklists },
  { id: 'lancamentos', nome: 'Lançamentos', icone: ic.list(18), sub: 'Tudo o que o campo lançou', pagina: paginaLancamentos },
  { id: 'aprovacoes', nome: 'Aprovações', icone: ic.pedido(18), sub: 'Pedidos de correção do campo', pagina: paginaAprovacoes },
  { id: 'desvios', nome: 'Desvios', icone: ic.alert(18), sub: 'Motivos de baixa aderência', pagina: paginaDesvios },
  { id: 'config', nome: 'Configuração', icone: ic.engrenagem(18), sub: 'Pesos das etapas, checklist e cadastros', pagina: paginaConfig }
];

export function montarPainel(root, { perfil, menuDemo, trocarVisao }) {
  const leitura = somenteLeitura(perfil);
  let rota = NAV.find((n) => n.id === location.hash.slice(2)) ? location.hash.slice(2) : 'visao';
  let calc = null;
  let mudou = new Set();
  let nivelAnterior = null;
  let pendente = false;
  let rotaDesenhada = null;

  const conteudo = el('div', { class: 'desktop-content' });
  const titulo = el('h1', {}, '');
  const subtitulo = el('p', { class: 'fraco', style: { fontSize: '13px' } }, '');
  const links = {};
  const badges = {
    aprovacoes: el('span', { class: 'badge badge-warn', style: { display: 'none' } }, '0'),
    checklists: el('span', { class: 'badge badge-info', style: { display: 'none' } }, '0')
  };
  const nav = el('nav', { class: 'sidebar-nav', 'aria-label': 'Páginas do painel' }, NAV.map((n) => {
    const b = el('button', { class: 'sidebar-link', type: 'button', title: n.nome, onclick: () => (location.hash = `/${n.id}`) }, [el('span', { class: 'sidebar-icon', html: n.icone }), el('span', { class: 'sidebar-label' }, n.nome), badges[n.id] || null]);
    links[n.id] = b;
    return b;
  }));

  const MENU = 'prim.menu';
  let recolhido;
  try {
    recolhido = (localStorage.getItem(MENU) || (innerWidth < 1200 ? 'recolhido' : 'aberto')) === 'recolhido';
  } catch {
    recolhido = innerWidth < 1200;
  }
  const alternar = el('button', { class: 'sidebar-toggle', type: 'button', onclick: () => recolher(!recolhido) });
  const shell = el('div', { class: 'desktop-shell' }, [
    el('aside', { class: 'desktop-sidebar' }, [
      el('div', { class: 'sidebar-brand' }, [el('div', { class: 'sidebar-brand-text' }, [el('div', { class: 'marca' }, 'Primárias'), el('div', { class: 'marca-tag' }, 'REFRAMAX · Coqueria')]), alternar]),
      nav,
      el('div', { class: 'sidebar-footer' }, [
        el('div', { class: 'sidebar-user', title: perfil.nome }, [el('span', { class: 'avatar' }, initials(perfil.nome)), el('div', { class: 'sidebar-label' }, [el('div', { class: 'sidebar-user-name' }, perfil.nome), el('div', { class: 'sidebar-user-role' }, PAPEIS[perfil.papel].nome)])]),
        trocarVisao ? el('button', { class: 'btn btn-outline btn-sm btn-block', title: 'Ver o app como o campo vê', type: 'button', onclick: () => trocarVisao('campo') }, [el('span', { class: 'sidebar-icon', html: ic.clock(15) }), el('span', { class: 'sidebar-label' }, 'Ver app de campo')]) : null,
        el('button', { class: 'btn btn-ghost btn-sm btn-block', title: 'Sair', type: 'button', onclick: () => window.dispatchEvent(new CustomEvent('prim:sair')) }, [el('span', { class: 'sidebar-icon', html: ic.logout(15) }), el('span', { class: 'sidebar-label' }, 'Sair')]),
        credito('credito-sidebar')
      ])
    ]),
    el('main', { class: 'desktop-main' }, [
      el('div', { class: 'desktop-topbar' }, [
        el('div', {}, [titulo, subtitulo]),
        el('div', { class: 'topo-acoes' }, [
          leitura ? el('span', { class: 'somente-leitura' }, [el('span', { html: ic.olho(14), style: { display: 'inline-flex' } }), 'Só leitura']) : null,
          el('span', { class: 'ao-vivo' }, 'ao vivo'),
          el('button', { class: 'demo-pilula', type: 'button', onclick: menuDemo }, [el('span', { class: 'vivo' }), 'Demonstração'])
        ])
      ]),
      conteudo
    ])
  ]);
  mount(root, [shell]);
  recolher(recolhido);

  function recolher(v) {
    recolhido = v;
    shell.classList.toggle('menu-recolhido', v);
    alternar.innerHTML = v ? ic.menu(18) : ic.chevronLeft(18);
    alternar.setAttribute('aria-label', v ? 'Abrir menu' : 'Recolher menu');
    try {
      localStorage.setItem(MENU, v ? 'recolhido' : 'aberto');
    } catch {
      /* sem armazenamento */
    }
  }

  const aoMudarHash = () => {
    const r = location.hash.slice(2);
    rota = NAV.find((n) => n.id === r) ? r : 'visao';
    window.scrollTo({ top: 0 });
    desenhar();
  };
  window.addEventListener('hashchange', aoMudarHash);
  const digitando = () => conteudo.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  conteudo.addEventListener('focusout', () => pendente && setTimeout(() => !digitando() && desenhar(), 0));

  const parar = assinar((estado) => {
    calc = calcular(estado);
    mudou = new Set();
    if (nivelAnterior) calc.nivel.forEach((n, i) => n > nivelAnterior[i] && mudou.add(i));
    nivelAnterior = calc.nivel.slice();
    if (digitando()) pendente = true;
    else desenhar();
  });

  function desenhar() {
    pendente = false;
    const n = NAV.find((x) => x.id === rota);
    titulo.textContent = n.nome;
    subtitulo.textContent = n.sub;
    Object.entries(links).forEach(([id, b]) => b.classList.toggle('active', id === rota));
    const pedidos = calc.estado.correcoes.filter((c) => c.status === 'pendente').length;
    const ckEnviados = Object.values(checklists(calc)).filter((c) => c.status === 'enviado').length;
    badges.aprovacoes.style.display = pedidos ? 'inline-flex' : 'none';
    badges.aprovacoes.textContent = String(pedidos);
    badges.checklists.style.display = ckEnviados ? 'inline-flex' : 'none';
    badges.checklists.textContent = String(ckEnviados);
    const ctx = { calc, perfil, leitura, mudou, ir: (r) => (location.hash = `/${r}`) };
    const pagina = el('div', { class: rotaDesenhada === rota ? 'painel-pagina sem-entrada' : 'painel-pagina' }, n.pagina(ctx));
    rotaDesenhada = rota;
    mount(conteudo, [pagina]);
  }

  return () => {
    parar();
    window.removeEventListener('hashchange', aoMudarHash);
  };
}
