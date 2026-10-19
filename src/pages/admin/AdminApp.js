import { el, mount } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { initials } from '../../utils/format.js';
import { navigate, currentRoute, onRouteChange } from '../../router.js';
import { subscribeColaboradores } from '../../lib/collaborators.js';
import { subscribeAtividades } from '../../lib/activities.js';
import { subscribeSetores } from '../../lib/setores.js';
import { subscribeClientes, subscribeContratos, subscribeProjetos } from '../../lib/projetos.js';
import { subscribeTodosLancamentos } from '../../lib/records.js';
import { subscribeAllUsers } from '../../lib/auth.js';
import { logoutUser } from '../../lib/auth.js';
import { renderDashboardPage } from './AdminDashboard.js';
import { renderRecordsPage } from './AdminRecords.js';
import { renderUsersPage } from './AdminUsers.js';
import { renderCatalogPage } from './AdminCatalog.js';
import { renderSetoresPage } from './AdminSetores.js';
import { renderProjetosPage } from './AdminProjetos.js';
import { renderEstudosPage } from '../estudos/EstudosPage.js';
import { subscribeEstudos } from '../../lib/estudos.js';

const NAV = [
  { page: 'dashboard', label: 'Dashboard', icon: icon.grid(18) },
  { page: 'projetos', label: 'Projetos', icon: icon.folder(18) },
  { page: 'estudos', label: 'Estudos', icon: icon.target(18) },
  { page: 'lancamentos', label: 'Lançamentos', icon: icon.clock(18) },
  { page: 'cadastros', label: 'Cadastros', icon: icon.briefcase(18) },
  { page: 'setores', label: 'Setores', icon: icon.building(18) },
  { page: 'usuarios', label: 'Usuários', icon: icon.users(18), soAdmin: true }
];

const TITLES = {
  dashboard: ['Dashboard', 'Indicadores de produtividade em tempo real'],
  projetos: ['Projetos', 'Planejamento por cliente e contrato — planejado × real'],
  estudos: ['Estudos de tempos', 'Cronoanálise, amostragem, MTM, takt/lead time e tempos históricos'],
  lancamentos: ['Lançamentos', 'Todos os apontamentos coletados em campo'],
  cadastros: ['Cadastros', 'Atividades, improdutividades e colaboradores'],
  setores: ['Setores', 'Configuração de turno e capacidade por área'],
  usuarios: ['Usuários', 'Aprovação de acesso e permissões']
};

export function mountAdminApp(root, { profile }) {
  const isAdmin = profile.role === 'admin';
  // o planejador vê o mesmo painel, menos a aprovação de usuários (só admin)
  const navItems = NAV.filter((n) => isAdmin || !n.soAdmin);
  const state = {
    colaboradores: [], atividades: [], setores: [], lancamentos: [], usuarios: [], clientes: [], contratos: [], projetos: [], estudos: [],
    loaded: { c: false, a: false, s: false, l: false, u: !isAdmin, cl: false, ct: false, p: false, e: false }
  };

  const content = el('div', { class: 'desktop-content' });
  const topTitle = el('h1', {}, 'Dashboard');
  const topSubtitle = el('p', { style: { display: 'none' } });

  const navLinks = {};
  const nav = el(
    'div',
    { class: 'sidebar-nav' },
    navItems.map((item) => {
      const link = el('button', { class: 'sidebar-link', type: 'button', onclick: () => navigate(item.page) }, [
        el('span', { html: item.icon, style: { display: 'inline-flex' } }),
        item.label
      ]);
      navLinks[item.page] = link;
      return link;
    })
  );

  const pendingBadge = el('span', { class: 'badge badge-warn', style: { display: 'none' } }, '0');
  if (navLinks.usuarios) navLinks.usuarios.appendChild(pendingBadge);

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
            el('div', { class: 'sidebar-user-role' }, isAdmin ? 'Administrador' : 'Planejador')
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
    projetos: renderProjetosPage,
    estudos: (c) => renderEstudosPage({ ...c, gestor: true }),
    lancamentos: renderRecordsPage,
    cadastros: renderCatalogPage,
    setores: renderSetoresPage,
    usuarios: renderUsersPage
  };
  const instances = {};
  let mountedPage = null;

  function ctx() {
    return {
      colaboradores: state.colaboradores,
      atividades: state.atividades,
      setores: state.setores,
      lancamentos: state.lancamentos,
      usuarios: state.usuarios,
      clientes: state.clientes,
      contratos: state.contratos,
      projetos: state.projetos,
      estudos: state.estudos,
      profile
    };
  }

  function renderPage() {
    if (!allLoaded()) return;
    const { page } = currentRoute();
    const active = navItems.some((n) => n.page === page) ? page : 'dashboard';
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
  const unsubSetores = subscribeSetores((list) => {
    state.setores = list;
    state.loaded.s = true;
    renderPage();
  });
  const unsubLanc = subscribeTodosLancamentos((list) => {
    state.lancamentos = list;
    state.loaded.l = true;
    renderPage();
  });
  // a lista de usuários só é legível pelo admin (regras do Firestore)
  const unsubUsers = isAdmin
    ? subscribeAllUsers((list) => {
        state.usuarios = list;
        state.loaded.u = true;
        updatePendingBadge();
        renderPage();
      })
    : () => {};
  const unsubPlan = [
    subscribeClientes((list) => { state.clientes = list; state.loaded.cl = true; renderPage(); }),
    subscribeContratos((list) => { state.contratos = list; state.loaded.ct = true; renderPage(); }),
    subscribeProjetos((list) => { state.projetos = list; state.loaded.p = true; renderPage(); }),
    subscribeEstudos((list) => { state.estudos = list; state.loaded.e = true; renderPage(); })
  ];
  const unsubRoute = onRouteChange(renderPage);

  if (!currentRoute().page) navigate('dashboard');

  return () => {
    unsubColab();
    unsubAtiv();
    unsubSetores();
    unsubLanc();
    unsubUsers();
    unsubPlan.forEach((u) => u());
    unsubRoute();
  };
}
