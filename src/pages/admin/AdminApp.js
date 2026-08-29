import { el, mount } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { initials } from '../../utils/format.js';
import { navigate, currentRoute, onRouteChange } from '../../router.js';
import { subscribeColaboradores } from '../../lib/collaborators.js';
import { subscribeAtividades } from '../../lib/activities.js';
import { subscribeTodosLancamentos } from '../../lib/records.js';
import { subscribeAllUsers } from '../../lib/auth.js';
import { logoutUser } from '../../lib/auth.js';
import { renderDashboardPage } from './AdminDashboard.js';
import { renderRecordsPage } from './AdminRecords.js';
import { renderUsersPage } from './AdminUsers.js';
import { renderCatalogPage } from './AdminCatalog.js';

const NAV = [
  { page: 'dashboard', label: 'Dashboard', icon: icon.grid(18) },
  { page: 'lancamentos', label: 'Lançamentos', icon: icon.clock(18) },
  { page: 'cadastros', label: 'Cadastros', icon: icon.briefcase(18) },
  { page: 'usuarios', label: 'Usuários', icon: icon.users(18) }
];

const TITLES = {
  dashboard: ['Dashboard', 'Indicadores de produtividade em tempo real'],
  lancamentos: ['Lançamentos', 'Todos os apontamentos coletados em campo'],
  cadastros: ['Cadastros', 'Atividades, improdutividades e colaboradores'],
  usuarios: ['Usuários', 'Aprovação de acesso e permissões']
};

export function mountAdminApp(root, { profile }) {
  const state = { colaboradores: [], atividades: [], lancamentos: [], usuarios: [], loaded: { c: false, a: false, l: false, u: false } };

  const content = el('div', { class: 'desktop-content' });
  const topTitle = el('h1', {}, 'Dashboard');
  const topSubtitle = el('p', { style: { display: 'none' } });

  const navLinks = {};
  const nav = el(
    'div',
    { class: 'sidebar-nav' },
    NAV.map((item) => {
      const link = el('button', { class: 'sidebar-link', type: 'button', onclick: () => navigate(item.page) }, [
        el('span', { html: item.icon, style: { display: 'inline-flex' } }),
        item.label
      ]);
      navLinks[item.page] = link;
      return link;
    })
  );

  const pendingBadge = el('span', { class: 'badge badge-warn', style: { display: 'none' } }, '0');
  navLinks.usuarios.appendChild(pendingBadge);

  const shell = el('div', { class: 'desktop-shell' }, [
    el('aside', { class: 'desktop-sidebar' }, [
      el('div', { class: 'sidebar-brand' }, [
        el('div', { class: 'brand-word brand-word-md' }, 'REFRAMAX'),
        el('div', { class: 'brand-tag brand-tag-md' }, 'Tempos & Métodos')
      ]),
      nav,
      el('div', { class: 'sidebar-footer' }, [
        el('div', { class: 'sidebar-user' }, [
          el('span', { class: 'avatar' }, initials(profile.nomeCompleto)),
          el('div', {}, [
            el('div', { class: 'sidebar-user-name' }, profile.nomeCompleto),
            el('div', { class: 'sidebar-user-role' }, 'Administrador')
          ])
        ]),
        el('button', { class: 'btn btn-ghost btn-sm btn-block', onclick: () => logoutUser() }, [el('span', { html: icon.logout(15) }), ' Sair'])
      ])
    ]),
    el('main', { class: 'desktop-main' }, [
      el('div', { class: 'desktop-topbar' }, [el('div', {}, [topTitle, topSubtitle])]),
      content
    ])
  ]);

  mount(root, [shell]);

  function updatePendingBadge() {
    const n = state.usuarios.filter((u) => u.status === 'pendente').length;
    pendingBadge.style.display = n > 0 ? 'inline-flex' : 'none';
    pendingBadge.textContent = String(n);
  }

  function allLoaded() {
    return Object.values(state.loaded).every(Boolean);
  }

  const factories = {
    dashboard: renderDashboardPage,
    lancamentos: renderRecordsPage,
    cadastros: renderCatalogPage,
    usuarios: renderUsersPage
  };
  const instances = {};
  let mountedPage = null;

  function ctx() {
    return { colaboradores: state.colaboradores, atividades: state.atividades, lancamentos: state.lancamentos, usuarios: state.usuarios, profile };
  }

  function renderPage() {
    if (!allLoaded()) return;
    const { page } = currentRoute();
    const active = NAV.some((n) => n.page === page) ? page : 'dashboard';
    Object.entries(navLinks).forEach(([key, node]) => node.classList.toggle('active', key === active));
    const [title, subtitle] = TITLES[active];
    topTitle.textContent = title;
    topSubtitle.textContent = subtitle;
    topSubtitle.style.display = 'block';
    topSubtitle.style.color = 'var(--text-2)';
    topSubtitle.style.fontSize = '12px';

    // mantém instância viva por página: preserva filtros/estado da UI entre
    // trocas de aba e apenas repassa dados novos via update(), sem remontar.
    Object.entries(instances).forEach(([key, inst]) => {
      if (key !== active && inst.update) inst.update(ctx());
    });

    if (!instances[active]) {
      instances[active] = factories[active](ctx());
      mount(content, [instances[active].node]);
      mountedPage = active;
    } else {
      if (instances[active].update) instances[active].update(ctx());
      if (mountedPage !== active) {
        mount(content, [instances[active].node]);
        mountedPage = active;
      }
    }
  }

  const unsubColab = subscribeColaboradores((list) => {
    state.colaboradores = list;
    state.loaded.c = true;
    renderPage();
  });
  const unsubAtiv = subscribeAtividades((list) => {
    state.atividades = list;
    state.loaded.a = true;
    renderPage();
  });
  const unsubLanc = subscribeTodosLancamentos((list) => {
    state.lancamentos = list;
    state.loaded.l = true;
    renderPage();
  });
  const unsubUsers = subscribeAllUsers((list) => {
    state.usuarios = list;
    state.loaded.u = true;
    updatePendingBadge();
    renderPage();
  });
  const unsubRoute = onRouteChange(renderPage);

  if (!currentRoute().page) navigate('dashboard');

  return () => {
    unsubColab();
    unsubAtiv();
    unsubLanc();
    unsubUsers();
    unsubRoute();
  };
}
