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
  const state = {
    colaboradores: [],
    atividades: [],
    lancamentos: [],
    loaded: { colaboradores: false, atividades: false, lancamentos: false },
    rendered: false
  };
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
  const syncIconSpan = el('span', { html: icon.check(22), style: { display: 'inline-flex' } });
  const syncBtn = el(
    'button',
    {
      class: 'sync-fab idle',
      type: 'button',
      title: 'Sincronizar agora',
      onclick: onSyncClick
    },
    [syncIconSpan, syncBadge]
  );
  const syncLabel = el('span', { class: 'sync-fab-label' }, 'tudo certo');
  const syncNavWrap = el('div', { class: 'mobile-nav-sync' }, [syncBtn, syncLabel]);

  const shell = el('div', { class: 'mobile-shell' }, [
    el('div', { class: 'mobile-topbar' }, [
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
        el('div', {}, [
          el('div', { class: 'brand-word brand-word-sm' }, 'REFRAMAX'),
          el('div', { class: 'brand-tag brand-tag-sm' }, 'Tempos & Métodos')
        ]),
        el('div', { style: { width: '1px', height: '26px', background: 'var(--border)' } }),
        topTitle
      ]),
      el('button', { class: 'btn btn-icon btn-ghost btn-sm', title: 'Sair', onclick: () => logoutUser() }, el('span', { html: icon.logout(16) }))
    ]),
    banner,
    content,
    el('div', { class: 'mobile-nav' }, [navLancar, syncNavWrap, navHistorico])
  ]);

  mount(root, [shell]);

  async function onSyncClick() {
    if (syncing) return;
    const pending = state.lancamentos.filter((l) => !l._sincronizado).length;
    if (!isOnline()) {
      toast('Sem conexão agora. Os dados serão enviados automaticamente assim que a internet voltar.', 'info');
      return;
    }
    if (pending === 0) {
      toast('Tudo já está sincronizado.', 'ok');
      return;
    }
    syncing = true;
    applySyncVisual();
    try {
      const result = await syncNow();
      if (result.ok) {
        toast(`${pending} lançamento(s) sincronizado(s) com sucesso.`, 'ok');
      }
    } catch {
      toast('Não foi possível sincronizar agora. Tentaremos automaticamente.', 'error');
    } finally {
      syncing = false;
      applySyncVisual();
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

  function applySyncVisual() {
    const pending = state.lancamentos.filter((l) => !l._sincronizado).length;
    const state3 = syncing ? 'syncing' : pending > 0 ? 'pending' : 'idle';

    syncBtn.classList.remove('idle', 'pending', 'syncing');
    syncBtn.classList.add(state3);
    syncNavWrap.classList.toggle('pending', state3 !== 'idle');

    syncBadge.style.display = pending > 0 ? 'flex' : 'none';
    syncBadge.textContent = String(pending);

    if (state3 === 'syncing') {
      syncIconSpan.innerHTML = icon.sync(22);
      syncLabel.textContent = 'sincronizando…';
    } else if (state3 === 'pending') {
      syncIconSpan.innerHTML = icon.sync(24);
      syncLabel.textContent = `${pending} pendente${pending > 1 ? 's' : ''}`;
    } else {
      syncIconSpan.innerHTML = icon.check(22);
      syncLabel.textContent = 'tudo certo';
    }
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

  /**
   * As 3 assinaturas (colaboradores, atividades, lançamentos) resolvem em
   * paralelo e em ordem imprevisível. Renderizar assim que a primeira
   * responder — como o código fazia antes — corre o risco de montar a tela
   * de Lançar com listas de atividades/colaboradores ainda vazias, e elas
   * nunca mais são atualizadas depois (a tela só remonta ao trocar de aba).
   * Por isso a primeira renderização só acontece quando as 3 já chegaram.
   */
  function allLoaded() {
    return Object.values(state.loaded).every(Boolean);
  }

  function renderInitial() {
    if (state.rendered || !allLoaded()) return;
    state.rendered = true;
    if (!currentRoute().page) navigate('lancar');
    else renderPage();
  }

  const unsubColab = subscribeColaboradores((list) => {
    state.colaboradores = list;
    state.loaded.colaboradores = true;
    renderInitial();
  });
  const unsubAtiv = subscribeAtividades((list) => {
    state.atividades = list;
    state.loaded.atividades = true;
    renderInitial();
  });
  const unsubLanc = subscribeMeusLancamentos(profile.uid, (list) => {
    state.lancamentos = list;
    applySyncVisual();
    if (historyRefresh) historyRefresh(list);
    state.loaded.lancamentos = true;
    renderInitial();
  });
  const unsubRoute = onRouteChange(renderPage);
  const unsubConn = onConnectivityChange((online) => {
    banner.style.display = online ? 'none' : 'flex';
  });
  banner.style.display = isOnline() ? 'none' : 'flex';

  return () => {
    unsubColab();
    unsubAtiv();
    unsubLanc();
    unsubRoute();
    unsubConn();
  };
}
