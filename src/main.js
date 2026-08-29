import './styles/main.css';
import { el, mount } from './utils/dom.js';
import { observeSession } from './lib/auth.js';
import { renderLogin, renderRegister, renderStatusScreen } from './pages/AuthScreens.js';
import { mountMobileApp } from './pages/mobile/MobileApp.js';
import { mountAdminApp } from './pages/admin/AdminApp.js';
import { firebaseConfigured } from './lib/firebase.js';

const app = document.getElementById('app');
let authMode = 'login';
let cleanupApp = null;

function teardown() {
  if (cleanupApp) {
    cleanupApp();
    cleanupApp = null;
  }
}

function renderMisconfigured() {
  mount(app, [
    el('div', { class: 'auth-screen' }, [
      el('div', { class: 'auth-card' }, [
        el('div', { class: 'auth-pending' }, [
          el('h3', {}, 'Configuração pendente'),
          el(
            'p',
            { style: { color: 'var(--text-2)', fontSize: '13.5px' } },
            'O REFRAMAX ainda não está conectado a um projeto Firebase. Copie ".env.example" para ".env", preencha com as credenciais do seu projeto e reinicie o servidor. Veja o README para o passo a passo completo.'
          )
        ])
      ])
    ])
  ]);
}

function boot() {
  if (!firebaseConfigured) {
    renderMisconfigured();
    return;
  }

  observeSession(({ user, profile }) => {
    teardown();

    if (!user) {
      if (authMode === 'register') renderRegister(app, { onSwitch: switchToLogin });
      else renderLogin(app, { onSwitch: switchToRegister });
      return;
    }

    if (!profile) {
      // doc de usuário ainda não propagou (raríssimo, logo após cadastro) — trata como pendente
      renderStatusScreen(app, { status: 'pendente', nome: user.displayName });
      return;
    }

    if (profile.status !== 'aprovado') {
      renderStatusScreen(app, { status: profile.status, nome: profile.nomeCompleto });
      return;
    }

    if (profile.role === 'admin') {
      cleanupApp = mountAdminApp(app, { profile });
    } else {
      cleanupApp = mountMobileApp(app, { profile });
    }
  });
}

function switchToRegister() {
  authMode = 'register';
  renderRegister(app, { onSwitch: switchToLogin });
}
function switchToLogin() {
  authMode = 'login';
  renderLogin(app, { onSwitch: switchToRegister });
}

boot();
