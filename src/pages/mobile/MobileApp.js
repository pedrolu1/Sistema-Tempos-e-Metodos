import { el, mount } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { navigate, currentRoute, onRouteChange } from '../../router.js';
import { subscribeColaboradores } from '../../lib/collaborators.js';
import { subscribeAtividades } from '../../lib/activities.js';
import { subscribeMeusLancamentos } from '../../lib/records.js';
import { syncNow, isOnline, onConnectivityChange } from '../../lib/sync.js';
import { logoutUser } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { renderLaunchPage } from './MobileLaunch.js';
import { renderHistoryPage } from './MobileHistory.js';

export function mountMobileApp(root, { profile }) {
  const state = { colaboradores: [], atividades: [], lancamentos: [], loaded: false };
  let historyRefresh = null;
  let syncing = false;

  const content = el('div', { class: 'mobile-content' });
  const topTitle = el('div', { class: 'mobile-topbar-title' }, ['Lançar', el('small', {}, `Olá, ${profile.nomeCompleto?.split(' ')[0] || ''}`)]);

  const banner = el('div', { class: 'connectivity-banner offline', style: { display: 'none' } }, [
    el('span', { html: icon.wifiOff(15) }),
    'Sem conexão — os lançamentos ficam salvos no aparelho e sobem sozinhos quando a rede voltar.'
  ]);

  const navLancar = navItem(icon.clock(22), 'Lançar', () => navigate('lancar'));
  const navHistorico = navItem(icon.list(22), 'Consultar', () => navigate('consultar'));

  const syncBadge = el('span', { class: 'sync-count', style: { display: 'none' } }, '0');
  const syncBtn = el(
    'button',
    {
      class: 'sync-fab',
      type: 'button',
      title: 'Sincronizar agora',
      onclick: onSyncClick
    },
    [el('span', { html: icon.sync(24), style: { display: 'inline-flex' } }), syncBadge]
  );

  const shell = el('div', { class: 'mobile-shell' }, [
    el('div', { class: 'mobile-topbar' }, [
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '11px' } }, [
        el('div', { class: 'brand-logo-chip sm' }, el('img', { src: './brand/reframax-logo.png', alt: 'Reframax', class: 'mobile-topbar-logo' })),
        topTitle
      ]),
      el('button', { class: 'btn btn-icon btn-ghost btn-sm', title: 'Sair', onclick: () => logoutUser() }, el('span', { html: icon.logout(16) }))
    ]),
    banner,
    content,
    el('div', { class: 'mobile-nav' }, [
      navLancar,
      el('div', { class: 'mobile-nav-sync' }, [syncBtn, el('span', { class: 'sync-fab-label' }, 'sincronizar')]),
      navHistorico
    ])
  ]);

  mount(root, [shell]);

  async function onSyncClick() {
    if (syncing) return;
    syncing = true;
    syncBtn.classList.add('syncing');
    const pending = state.lancamentos.filter((l) => !l._sincronizado).length;
    if (!isOnline()) {
      toast('Sem conexão agora. Os dados serão enviados automaticamente assim que a internet voltar.', 'info');
      syncing = false;
      syncBtn.classList.remove('syncing');
      return;
    }
    try {
      const result = await syncNow();
      if (result.ok) {
        toast(pending > 0 ? `${pending} lançamento(s) sincronizado(s) com sucesso.` : 'Tudo já está sincronizado.', 'ok');
      }
    } catch {
      toast('Não foi possível sincronizar agora. Tentaremos automaticamente.', 'error');
    } finally {
      syncing = false;
      syncBtn.classList.remove('syncing');
    }
  }

  function navItem(iconHtml, label, onClick) {
    const b = el('button', { class: 'mobile-nav-item', type: 'button', onclick: onClick }, [
      el('span', { html: iconHtml, style: { display: 'inline-flex' } }),
      label
    ]);
    return b;
  }

  function updateActiveNav(page) {
    navLancar.classList.toggle('active', page === 'lancar');
    navHistorico.classList.toggle('active', page !== 'lancar');
    topTitle.firstChild.textContent = page === 'consultar' ? 'Meus lançamentos' : 'Lançar';
  }

  function updateSyncBadge() {
    const pending = state.lancamentos.filter((l) => !l._sincronizado).length;
    syncBadge.style.display = pending > 0 ? 'flex' : 'none';
    syncBadge.textContent = String(pending);
  }

  function renderPage() {
    const { page } = currentRoute();
    const active = page === 'consultar' ? 'consultar' : 'lancar';
    updateActiveNav(active);
    historyRefresh = null;

    if (active === 'lancar') {
      mount(content, [
        renderLaunchPage({
          colaboradores: state.colaboradores,
          atividades: state.atividades,
          profile
        })
      ]);
    } else {
      const { node, refresh } = renderHistoryPage({
        lancamentos: state.lancamentos,
        colaboradores: state.colaboradores,
        atividades: state.atividades
      });
      mount(content, [node]);
      historyRefresh = refresh;
    }
  }

  const unsubColab = subscribeColaboradores((list) => {
    state.colaboradores = list;
  });
  const unsubAtiv = subscribeAtividades((list) => {
    state.atividades = list;
  });
  const unsubLanc = subscribeMeusLancamentos(profile.uid, (list) => {
    state.lancamentos = list;
    updateSyncBadge();
    if (historyRefresh) historyRefresh(list);
    if (!state.loaded) {
      state.loaded = true;
      renderPage();
    }
  });
  const unsubRoute = onRouteChange(renderPage);
  const unsubConn = onConnectivityChange((online) => {
    banner.style.display = online ? 'none' : 'flex';
  });
  banner.style.display = isOnline() ? 'none' : 'flex';

  if (!currentRoute().page) navigate('lancar');
  else renderPage();

  return () => {
    unsubColab();
    unsubAtiv();
    unsubLanc();
    unsubRoute();
    unsubConn();
  };
}
