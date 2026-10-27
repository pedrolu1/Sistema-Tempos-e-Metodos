// App de campo (líder e apontador): Hoje, Mapa, Lançar, Checklist e RDO.
import { el, mount } from '../../../../src/utils/dom.js';
import { ic } from '../../lib/icones.js';
import { assinar } from '../../lib/store.js';
import { calcular, statsPessoa } from '../../lib/calculo.js';
import { abrirLancamento, mostrarBlocoAtivo } from '../../components/lancar.js';
import { paginaHoje } from './Hoje.js';
import { paginaMapa } from './Mapa.js';
import { paginaChecklist } from './Checklist.js';
import { paginaRdo } from './Rdo.js';
import { paginaPerfil } from './Perfil.js';

const PAGINAS = { hoje: paginaHoje, mapa: paginaMapa, checklist: paginaChecklist, rdo: paginaRdo, perfil: paginaPerfil };

export function montarCampo(root, { perfil, menuDemo, trocarVisao }) {
  let rota = PAGINAS[location.hash.slice(2)] ? location.hash.slice(2) : 'hoje';
  let calc = null;
  let mudou = new Set();
  let nivelAnterior = null;
  let pendente = false;

  const conteudo = el('main', { class: 'campo-conteudo entrando' });
  setTimeout(() => conteudo.classList.remove('entrando'), 600);
  const chama = el('span', { class: 'chama-chip', title: 'Dias úteis seguidos lançando' });
  const nivelBotao = el('button', { class: 'nivel-botao', type: 'button', 'aria-label': 'Meu perfil', onclick: () => ir('perfil') }, el('span'));
  const navItens = {
    hoje: navItem('hoje', ic.casa(22), 'Hoje'),
    mapa: navItem('mapa', ic.mapa(22), 'Mapa'),
    checklist: navItem('checklist', ic.prancheta(22), 'Checklist'),
    rdo: navItem('rdo', ic.diario(22), 'RDO')
  };
  const fab = el('button', { class: 'fab', type: 'button', 'aria-label': 'Lançar', onclick: () => abrirLancamento({ perfil }), html: ic.plus(30) });

  mount(root, [
    el('div', { class: 'campo' }, [
      el('header', { class: 'campo-topo' }, [
        el('div', { class: 'marca marca-sm' }, 'Primárias'),
        el('button', { class: 'demo-pilula', type: 'button', onclick: menuDemo }, [el('span', { class: 'vivo' }), 'Demo']),
        chama,
        nivelBotao
      ]),
      conteudo,
      el('nav', { class: 'campo-nav', 'aria-label': 'Navegação' }, [navItens.hoje, navItens.mapa, fab, navItens.checklist, navItens.rdo])
    ])
  ]);

  function navItem(id, svg, rotulo) {
    return el('button', { class: 'nav-item', type: 'button', onclick: () => ir(id) }, [el('span', { html: svg, style: { display: 'inline-flex' } }), rotulo]);
  }

  function ir(r) {
    location.hash = `/${r}`;
  }
  const aoMudarHash = () => {
    const r = location.hash.slice(2);
    rota = PAGINAS[r] ? r : 'hoje';
    window.scrollTo({ top: 0 });
    // a animação de entrada só na troca de aba, não a cada atualização ao vivo
    conteudo.classList.add('entrando');
    desenhar();
    setTimeout(() => conteudo.classList.remove('entrando'), 500);
  };
  window.addEventListener('hashchange', aoMudarHash);

  // redesenha a cada mudança no banco, mas não enquanto alguém digita
  const aoSairDoCampo = () => pendente && setTimeout(() => !digitando() && desenhar(), 0);
  conteudo.addEventListener('focusout', aoSairDoCampo);
  const digitando = () => conteudo.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);

  const parar = assinar((estado) => {
    calc = calcular(estado);
    // primárias que avançaram desde o último desenho acendem no mapa
    mudou = new Set();
    if (nivelAnterior) calc.nivel.forEach((n, i) => n > nivelAnterior[i] && mudou.add(i));
    nivelAnterior = calc.nivel.slice();
    if (digitando()) pendente = true;
    else desenhar();
  });

  function desenhar() {
    pendente = false;
    const s = statsPessoa(calc, perfil.uid);
    chama.className = `chama-chip${s.sequencia > 0 ? ' acesa' : ''}`;
    chama.replaceChildren(el('span', { html: ic.chama(18), style: { display: 'inline-flex' } }), String(s.sequencia));
    nivelBotao.style.setProperty('--f', String(s.fracao));
    nivelBotao.firstChild.textContent = `${s.graus}°`;
    nivelBotao.title = `${s.graus} °C · ${s.xp} XP`;
    Object.entries(navItens).forEach(([id, b]) => b.classList.toggle('ativo', id === rota));
    fab.classList.toggle('chamando', s.hojeEtapas === 0);
    const ctx = { calc, perfil, stats: s, mudou, ir, lancar: (etapa, fornoId) => abrirLancamento({ perfil, etapa, fornoId }), trocarVisao };
    mount(conteudo, PAGINAS[rota](ctx));
    mostrarBlocoAtivo(conteudo);
  }

  return () => {
    parar();
    window.removeEventListener('hashchange', aoMudarHash);
  };
}
