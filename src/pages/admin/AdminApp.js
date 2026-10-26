import { el, mount } from '../../utils/dom.js';
import { avisoFalha, credito } from '../../components/ui.js';
import { protegerTela, registrarErro, repararApp } from '../../lib/saude.js';
import { icon } from '../../utils/icons.js';
import { initials } from '../../utils/format.js';
import { navigate, currentRoute, onRouteChange } from '../../router.js';
import { subscribeAtividades } from '../../lib/activities.js';
import { subscribeSetores } from '../../lib/setores.js';
import { subscribeClientes, subscribeContratos, subscribeProjetos } from '../../lib/projetos.js';
import { subscribeTodosLancamentos } from '../../lib/records.js';
import { subscribeAllUsers, subscribeAdminPrincipal } from '../../lib/auth.js';
import { abrirAlterarMinhaSenha } from '../../components/Senha.js';
import { logoutUser } from '../../lib/auth.js';
import { renderDashboardPage } from './AdminDashboard.js';
import { renderRecordsPage } from './AdminRecords.js';
import { renderUsersPage } from './AdminUsers.js';
import { renderSetoresPage } from './AdminSetores.js';
import { renderProjetosPage } from './AdminProjetos.js';
import { renderEstudosPage } from '../estudos/EstudosPage.js';
import { renderAssistentePage, achadosAtivos } from './AdminAssistente.js';
import { renderSistemaPage } from './AdminSistema.js';
import { subscribeSaude } from '../../lib/saude.js';
import { subscribeAuditoria } from '../../lib/auditoria.js';
import { subscribeUltimoBackup } from '../../lib/backup.js';
import { repararDados } from '../../lib/reparo.js';
import { vigiarInatividade } from '../../lib/inatividade.js';
import { isOnline } from '../../lib/sync.js';
import { subscribeEstudos } from '../../lib/estudos.js';

const NAV = [
  { page: 'dashboard', label: 'Dashboard', icon: icon.grid(18) },
  { page: 'assistente', label: 'Assistente', icon: icon.lightbulb(18) },
  { page: 'projetos', label: 'Projetos', icon: icon.folder(18) },
  { page: 'estudos', label: 'Estudos', icon: icon.target(18) },
  { page: 'lancamentos', label: 'Lançamentos', icon: icon.clock(18) },
  { page: 'setores', label: 'Setores', icon: icon.building(18) },
  { page: 'usuarios', label: 'Usuários', icon: icon.users(18), soAdmin: true },
  { page: 'sistema', label: 'Sistema', icon: icon.shield(18) }
];

const TITLES = {
  dashboard: ['Dashboard', 'Indicadores de produtividade em tempo real'],
  assistente: ['Assistente', 'Pontos de atenção e sugestões de melhoria encontrados nos dados'],
  projetos: ['Projetos', 'Planejamento por cliente e contrato — planejado × real'],
  estudos: ['Estudos de tempos', 'Cronoanálise, amostragem, MTM, takt/lead time e tempos históricos'],
  lancamentos: ['Lançamentos', 'Todos os apontamentos coletados em campo'],
  setores: ['Setores', 'Configuração de turno e capacidade por área'],
  usuarios: ['Usuários', 'Aprovação de acesso e permissões'],
  sistema: ['Sistema', 'Saúde do app, backup, auditoria e segurança']
};

export function mountAdminApp(root, { profile }) {
  const isAdmin = profile.role === 'admin';
  // o planejador vê o mesmo painel, menos a aprovação de usuários (só admin)
  const navItems = NAV.filter((n) => isAdmin || !n.soAdmin);
  const state = {
    atividades: [], setores: [], lancamentos: [], usuarios: [], clientes: [], contratos: [], projetos: [], estudos: [], saude: [], auditoria: [], ultimoBackup: null, adminPrincipal: null,
    loaded: { a: false, s: false, l: false, u: !isAdmin, cl: false, ct: false, p: false, e: false }
  };

  const content = el('div', { class: 'desktop-content' });
  const topTitle = el('h1', {}, 'Dashboard');
  const topSubtitle = el('p', { style: { display: 'none' } });

  const navLinks = {};
  const nav = el(
    'div',
    { class: 'sidebar-nav' },
    navItems.map((item) => {
      const link = el('button', { class: 'sidebar-link', type: 'button', title: item.label, onclick: () => navigate(item.page) }, [
        el('span', { class: 'sidebar-icon', html: item.icon }),
        el('span', { class: 'sidebar-label' }, item.label)
      ]);
      navLinks[item.page] = link;
      return link;
    })
  );

  const pendingBadge = el('span', { class: 'badge badge-warn', style: { display: 'none' } }, '0');
  if (navLinks.usuarios) navLinks.usuarios.appendChild(pendingBadge);
  const assistBadge = el('span', { class: 'badge badge-danger', style: { display: 'none' } }, '0');
  navLinks.assistente.appendChild(assistBadge);

  // menu lateral recolhível: a preferência fica salva neste computador; em
  // telas estreitas ele já começa recolhido para o conteúdo ter espaço
  const MENU_KEY = 'rfx.menu';
  let recolhido;
  try {
    const salvo = localStorage.getItem(MENU_KEY);
    recolhido = salvo ? salvo === 'recolhido' : window.innerWidth < 1200;
  } catch {
    recolhido = window.innerWidth < 1200;
  }
  const toggleMenu = el('button', { class: 'sidebar-toggle', type: 'button', onclick: () => alternarMenu() });
  function alternarMenu(valor = !recolhido) {
    recolhido = valor;
    shell.classList.toggle('menu-recolhido', recolhido);
    toggleMenu.innerHTML = recolhido ? icon.menu(18) : icon.chevronLeft(18);
    toggleMenu.title = recolhido ? 'Abrir menu' : 'Recolher menu';
    toggleMenu.setAttribute('aria-label', toggleMenu.title);
    try {
      localStorage.setItem(MENU_KEY, recolhido ? 'recolhido' : 'aberto');
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
  }

  const shell = el('div', { class: 'desktop-shell' }, [
    el('aside', { class: 'desktop-sidebar' }, [
      el('div', { class: 'sidebar-brand' }, [
        el('div', { class: 'sidebar-brand-text' }, [
          el('div', { class: 'brand-word brand-word-md' }, 'REFRAMAX'),
          el('div', { class: 'brand-tag brand-tag-md' }, 'Tempos & Métodos')
        ]),
        toggleMenu
      ]),
      nav,
      el('div', { class: 'sidebar-footer' }, [
        el('div', { class: 'sidebar-user', title: profile.nomeCompleto }, [
          el('span', { class: 'avatar' }, initials(profile.nomeCompleto)),
          el('div', { class: 'sidebar-label' }, [
            el('div', { class: 'sidebar-user-name' }, profile.nomeCompleto),
            el('div', { class: 'sidebar-user-role' }, isAdmin ? 'Administrador' : 'Planejador')
          ])
        ]),
        el('button', { class: 'btn btn-outline btn-sm btn-block', title: 'Ver o app como o apontador vê no celular', onclick: () => window.dispatchEvent(new CustomEvent('rfx:trocar-visao', { detail: 'campo' })) }, [el('span', { class: 'sidebar-icon', html: icon.clock(15) }), el('span', { class: 'sidebar-label' }, 'Ver app de campo')]),
        el('button', { class: 'btn btn-ghost btn-sm btn-block', title: 'Alterar minha senha', onclick: () => abrirAlterarMinhaSenha() }, [el('span', { class: 'sidebar-icon', html: icon.key(15) }), el('span', { class: 'sidebar-label' }, 'Alterar senha')]),
        el('button', { class: 'btn btn-ghost btn-sm btn-block', title: 'Sair', onclick: () => logoutUser() }, [el('span', { class: 'sidebar-icon', html: icon.logout(15) }), el('span', { class: 'sidebar-label' }, 'Sair')]),
        credito('credito-sidebar')
      ])
    ]),
    el('main', { class: 'desktop-main' }, [
      el('div', { class: 'desktop-topbar' }, [el('div', {}, [topTitle, topSubtitle])]),
      content
    ])
  ]);

  alternarMenu(recolhido);
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
    assistente: renderAssistentePage,
    projetos: renderProjetosPage,
    estudos: (c) => renderEstudosPage({ ...c, gestor: true }),
    lancamentos: renderRecordsPage,
    setores: renderSetoresPage,
    usuarios: renderUsersPage,
    sistema: renderSistemaPage
  };
  const instances = {};
  let mountedPage = null;

  function ctx() {
    return {
      atividades: state.atividades,
      setores: state.setores,
      lancamentos: state.lancamentos,
      usuarios: state.usuarios,
      clientes: state.clientes,
      contratos: state.contratos,
      projetos: state.projetos,
      estudos: state.estudos,
      saude: state.saude,
      auditoria: state.auditoria,
      ultimoBackup: state.ultimoBackup,
      adminPrincipal: state.adminPrincipal,
      profile
    };
  }

  /**
   * Nº de pontos críticos/de atenção ainda não dispensados, no menu do
   * Assistente. A análise percorre todos os dados: roda com um pequeno
   * atraso, uma vez só quando vários dados chegam juntos.
   */
  let badgeTimer = null;
  function updateAssistBadge() {
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => {
      const n = achadosAtivos(ctx()).filter((a) => a.nivel === 'critico' || a.nivel === 'atencao').length;
      assistBadge.style.display = n > 0 ? 'inline-flex' : 'none';
      assistBadge.textContent = String(n);
    }, 400);
  }

  /** Junta várias atualizações seguidas (cada coleção chega separada) em um único redesenho. */
  let renderAgendado = false;
  function renderPage() {
    if (renderAgendado) return;
    renderAgendado = true;
    requestAnimationFrame(() => {
      renderAgendado = false;
      renderAgora();
    });
  }

  function renderAgora() {
    if (!allLoaded()) return;
    updateAssistBadge();
    const { page } = currentRoute();
    const active = navItems.some((n) => n.page === page) ? page : 'dashboard';
    Object.entries(navLinks).forEach(([key, node]) => node.classList.toggle('active', key === active));
    const [title, subtitle] = TITLES[active];
    topTitle.textContent = title;
    topSubtitle.textContent = subtitle;
    topSubtitle.style.display = 'block';
    topSubtitle.style.color = 'var(--text-2)';
    topSubtitle.style.fontSize = '12px';

    // mantém instância viva por página (preserva filtros e estado da tela),
    // mas só a página aberta recalcula: as outras se atualizam ao serem abertas.
    if (instances[active]?.update) {
      try {
        instances[active].update(ctx());
      } catch (err) {
        // auto-recuperação: descarta a instância com problema e monta de novo
        registrarErro(`tela:${active}`, err, { recuperado: true });
        delete instances[active];
      }
    }
    if (!instances[active]) {
      instances[active] = protegerTela(active, () => factories[active](ctx()), () => ({
        node: avisoFalha({ aoTentar: () => { delete instances[active]; mountedPage = null; renderAgora(); }, aoReparar: repararApp })
      }));
      mount(content, [instances[active].node]);
      mountedPage = active;
    } else if (mountedPage !== active) {
      mount(content, [instances[active].node]);
      mountedPage = active;
    }
  }

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
  let reparoTimer = null;
  const unsubLanc = subscribeTodosLancamentos((list) => {
    state.lancamentos = list;
    state.loaded.l = true;
    renderPage();
    // auto-reparo de campos calculados inconsistentes (só com internet, sem pressa)
    clearTimeout(reparoTimer);
    reparoTimer = setTimeout(() => { if (isOnline()) repararDados(state.lancamentos); }, 4000);
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
    subscribeEstudos((list) => { state.estudos = list; state.loaded.e = true; renderPage(); }),
    subscribeSaude((list) => { state.saude = list; renderPage(); }),
    subscribeAuditoria((list) => { state.auditoria = list; renderPage(); }),
    subscribeAdminPrincipal((uid) => { state.adminPrincipal = uid; renderPage(); }),
    subscribeUltimoBackup((b) => { state.ultimoBackup = b; renderPage(); })
  ];
  const unsubRoute = onRouteChange(renderPage);

  if (!currentRoute().page) navigate('dashboard');

  // sessão do painel expira após 30 min sem uso (computador esquecido aberto)
  const avisoInatividade = el('div', { class: 'idle-banner', style: { display: 'none' } }, [
    el('span', { html: icon.clock(16), style: { display: 'inline-flex' } }),
    'Sem uso há quase 30 minutos — a sessão será encerrada em 1 minuto.',
    el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, 'Continuar conectado')
  ]);
  document.body.appendChild(avisoInatividade);
  const pararVigia = vigiarInatividade({
    minutos: 30,
    aoAvisar: (mostrar) => { avisoInatividade.style.display = mostrar ? 'flex' : 'none'; },
    aoExpirar: () => logoutUser()
  });

  return () => {
    unsubAtiv();
    unsubSetores();
    unsubLanc();
    unsubUsers();
    unsubPlan.forEach((u) => u());
    clearTimeout(reparoTimer);
    clearTimeout(badgeTimer);
    pararVigia();
    avisoInatividade.remove();
    unsubRoute();
  };
}
