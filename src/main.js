import './styles/main.css';
import { el, mount } from './utils/dom.js';
import { observeSession } from './lib/auth.js';
import { renderLogin, renderRegister, renderStatusScreen } from './pages/AuthScreens.js';
import { firebaseConfigured } from './lib/firebase.js';
import { instalarCapturaGlobal, definirContextoSaude } from './lib/saude.js';
import { definirUsuarioAuditoria } from './lib/auditoria.js';
import { ENDERECO_NOVO, noEnderecoAntigo, irParaEnderecoNovo, receberDoEnderecoAntigo } from './lib/mudancaEndereco.js';

// primeira coisa: qualquer falha daqui em diante é registrada e, quando dá, recuperada
instalarCapturaGlobal();
receberDoEnderecoAntigo();

// Versão nova publicada: o service worker novo baixa em segundo plano e assume
// sozinho (skipWaiting + clientsClaim), mas a tela aberta continua com o
// código antigo até recarregar. Recarregar na hora poderia apagar um
// lançamento que a pessoa está digitando, então:
//   - com o app em segundo plano e sem nada digitado nos últimos 15 min,
//     recarrega na hora (ninguém está usando);
//   - com o app em uso, mostra um aviso discreto com "Atualizar" e aplica
//     sozinho quando a pessoa sair do app sem estar no meio de um lançamento.
// Quem abre o app do zero já recebe a versão nova direto.
if ('serviceWorker' in navigator) {
  const tinhaVersao = Boolean(navigator.serviceWorker.controller); // na 1ª visita não há o que trocar
  let ultimaDigitacao = 0;
  let pronta = false;
  document.addEventListener('input', () => { ultimaDigitacao = Date.now(); }, true);
  const livre = () => Date.now() - ultimaDigitacao > 15 * 60 * 1000;
  const recarregar = () => window.location.reload();

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaVersao || pronta) return;
    pronta = true;
    if (document.visibilityState === 'hidden' && livre()) return recarregar();
    avisoVersaoNova(recarregar);
  });
  document.addEventListener('visibilitychange', () => {
    if (pronta && document.visibilityState === 'hidden' && livre()) recarregar();
  });

  // o registro automático do plugin PWA só procura versão nova quando a
  // página carrega — quem deixa o app aberto o turno inteiro não receberia.
  // Procura de novo sempre que o app volta a ficar visível e a cada hora.
  navigator.serviceWorker.ready.then((reg) => {
    const check = () => reg.update().catch(() => {});
    setInterval(check, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  });
}

function avisoVersaoNova(atualizar) {
  if (document.querySelector('.aviso-versao')) return;
  document.body.appendChild(
    el('div', { class: 'aviso-versao', role: 'status' }, [
      el('span', {}, 'Versão nova do app pronta'),
      el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: atualizar }, 'Atualizar')
    ])
  );
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

function renderMudanca() {
  mount(app, [
    el('div', { class: 'auth-screen' }, [
      el('div', { class: 'auth-card' }, [
        el('div', { class: 'auth-pending' }, [
          el('h3', {}, 'O app mudou de endereço'),
          el('p', { style: { color: 'var(--text-2)', fontSize: '13.5px' } }, 'Enviando o que estava pendente e abrindo o endereço novo. Lá, entre de novo com sua matrícula e senha. Se você usa o app instalado, instale de novo pelo endereço novo e apague o antigo.'),
          el('a', { class: 'btn btn-primary btn-block', href: ENDERECO_NOVO }, 'Abrir o endereço novo')
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

  let mudando = false;
  observeSession(({ user, profile }) => {
    // endereço antigo (GitHub Pages): com internet, envia o pendente e vai para a Netlify;
    // sem internet, o app segue funcionando aqui e muda quando a rede voltar
    if (noEnderecoAntigo && navigator.onLine) {
      if (!mudando) {
        mudando = true;
        teardown();
        renderMudanca();
        irParaEnderecoNovo({ comSessao: !!user });
      }
      return;
    }
    if (noEnderecoAntigo) window.addEventListener('online', () => location.reload(), { once: true });
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
