import './styles/main.css';
import { el, mount } from './utils/dom.js';
import { observeSession } from './lib/auth.js';
import { renderLogin, renderRegister, renderStatusScreen } from './pages/AuthScreens.js';
import { firebaseConfigured } from './lib/firebase.js';
import { instalarCapturaGlobal, definirContextoSaude } from './lib/saude.js';
import { definirUsuarioAuditoria } from './lib/auditoria.js';

// primeira coisa: qualquer falha daqui em diante é registrada e, quando dá, recuperada
instalarCapturaGlobal();

// O service worker (PWA) atualiza sozinho em segundo plano (skipWaiting +
// clientsClaim), mas isso só troca quem responde às próximas requisições —
// a aba já aberta continua rodando o JS antigo até recarregar. Sem isto, o
// app instalado no celular "trava" numa versão antiga até o usuário fechar
// e abrir de novo manualmente. Recarrega uma única vez assim que o novo
// service worker assume o controle da página.
if ('serviceWorker' in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  // o registro automático do plugin PWA só checa por atualização quando a
  // página carrega — quem deixa o app aberto o turno inteiro nunca recebe
  // versões novas. Reforça checando de novo sempre que a aba volta a ficar
  // visível (ex.: usuário volta pro app) e a cada hora enquanto ativo.
  navigator.serviceWorker.ready.then((reg) => {
    const check = () => reg.update().catch(() => {});
    setInterval(check, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  });
}

const app = document.getElementById('app');
let authMode = 'login';
let cleanupApp = null;
let geracao = 0; // invalida uma montagem que ainda estava carregando

function teardown() {
  geracao++;
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
    perfilAtual = null;
    const ativo = profile && profile.status === 'aprovado' ? profile : null;
    definirContextoSaude(ativo);
    definirUsuarioAuditoria(ativo);

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

    perfilAtual = profile;
    montarApp();
  });
}

// admin e planejador usam o painel; o apontador, o app de campo. O gestor
// pode alternar para ver o app de campo (ex.: conferir o que o apontador vê).
let perfilAtual = null;
function visaoCampo() {
  try {
    return sessionStorage.getItem('rfx.visao') === 'campo';
  } catch {
    return false;
  }
}
// cada versão é carregada só quando usada: o celular do apontador não baixa
// nem processa o código do painel (e vice-versa)
function montarApp() {
  const minha = ++geracao;
  const gestor = perfilAtual.role === 'admin' || perfilAtual.role === 'planejador';
  const carregar = gestor && !visaoCampo()
    ? import('./pages/admin/AdminApp.js').then((m) => m.mountAdminApp)
    : import('./pages/mobile/MobileApp.js').then((m) => m.mountMobileApp);
  carregar
    .then((montar) => {
      if (minha !== geracao || !perfilAtual) return; // a sessão mudou enquanto carregava
      cleanupApp = montar(app, { profile: perfilAtual });
    })
    .catch((err) => {
      mount(app, [el('div', { class: 'auth-screen' }, [el('div', { class: 'auth-card' }, [el('div', { class: 'auth-pending' }, [
        el('h3', {}, 'Não foi possível abrir o app'),
        el('p', { style: { color: 'var(--text-2)', fontSize: '13.5px' } }, 'Confira a internet e toque para tentar de novo.'),
        el('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => location.reload() }, 'Tentar de novo')
      ])])])]);
      throw err; // a captura global registra e, se for versão nova, recarrega sozinha
    });
}
window.addEventListener('rfx:trocar-visao', (e) => {
  try {
    sessionStorage.setItem('rfx.visao', e.detail);
  } catch {
    /* sem sessionStorage: troca só até recarregar */
  }
  if (!perfilAtual) return;
  teardown();
  location.hash = '';
  montarApp();
});

function switchToRegister() {
  authMode = 'register';
  renderRegister(app, { onSwitch: switchToLogin });
}
function switchToLogin() {
  authMode = 'login';
  renderLogin(app, { onSwitch: switchToRegister });
}

boot();
