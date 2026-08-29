import { el, mount } from '../utils/dom.js';
import { field, button, spinner } from '../components/ui.js';
import { icon } from '../utils/icons.js';
import { loginUser, registerUser, friendlyAuthError, logoutUser, isMatriculaValida } from '../lib/auth.js';
import { toast } from '../lib/toast.js';

function brand(tag) {
  return el('div', { class: 'auth-brand' }, [
    el('div', { html: markSvg(), style: { display: 'inline-flex' } }),
    el('div', {}, [
      el('div', { class: 'auth-brand-word' }, 'CRONOS'),
      el('div', { class: 'auth-brand-tag' }, tag)
    ])
  ]);
}

function markSvg() {
  return `<svg width="42" height="42" viewBox="0 0 56 56" fill="none"><circle cx="28" cy="28" r="24" stroke="url(#ag)" stroke-width="2.5"/><path d="M28 14v14l9 6" stroke="url(#ag)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><defs><linearGradient id="ag" x1="4" y1="4" x2="52" y2="52" gradientUnits="userSpaceOnUse"><stop stop-color="#ff8a3d"/><stop offset="1" stop-color="#ffb454"/></linearGradient></defs></svg>`;
}

export function renderLogin(root, { onSwitch }) {
  let loading = false;
  let error = '';

  const matriculaInput = el('input', {
    class: 'input',
    type: 'text',
    inputmode: 'numeric',
    pattern: '[0-9]{6}',
    maxlength: 6,
    placeholder: '130226',
    autocomplete: 'username',
    required: true
  });
  const passInput = el('input', { class: 'input', type: 'password', placeholder: '••••••••', autocomplete: 'current-password', required: true });

  const submitBtn = button({ label: 'Entrar', variant: 'primary', size: 'lg', block: true, type: 'submit' });

  const form = el(
    'form',
    {
      class: 'auth-form',
      onsubmit: async (e) => {
        e.preventDefault();
        if (loading) return;
        if (!isMatriculaValida(matriculaInput.value)) {
          toast('Digite os 6 dígitos da sua matrícula.', 'error');
          return;
        }
        loading = true;
        submitBtn.disabled = true;
        mount(submitBtn, [spinner()]);
        try {
          await loginUser({ matricula: matriculaInput.value, password: passInput.value });
        } catch (err) {
          toast(friendlyAuthError(err), 'error');
          loading = false;
          submitBtn.disabled = false;
          mount(submitBtn, ['Entrar']);
        }
      }
    },
    [
      field({ label: 'Matrícula', input: matriculaInput, hint: 'Os 6 dígitos da sua matrícula na empresa.' }),
      field({ label: 'Senha', input: passInput }),
      submitBtn
    ]
  );

  mount(root, [
    el('div', { class: 'auth-screen' }, [
      el('div', { class: 'auth-card' }, [
        brand('Tempos & Métodos'),
        form,
        el('div', { class: 'auth-switch' }, [
          'Ainda não tem conta? ',
          el('button', { type: 'button', onclick: onSwitch }, 'Criar acesso')
        ])
      ])
    ])
  ]);
}

export function renderRegister(root, { onSwitch }) {
  let loading = false;

  const nameInput = el('input', { class: 'input', type: 'text', placeholder: 'Seu nome completo', required: true });
  const matriculaInput = el('input', {
    class: 'input',
    type: 'text',
    inputmode: 'numeric',
    pattern: '[0-9]{6}',
    maxlength: 6,
    placeholder: '130226',
    autocomplete: 'username',
    required: true
  });
  const passInput = el('input', { class: 'input', type: 'password', placeholder: 'Mínimo 6 caracteres', required: true, minlength: 6 });

  const submitBtn = button({ label: 'Solicitar acesso', variant: 'primary', size: 'lg', block: true, type: 'submit' });

  const form = el(
    'form',
    {
      class: 'auth-form',
      onsubmit: async (e) => {
        e.preventDefault();
        if (loading) return;
        if (!isMatriculaValida(matriculaInput.value)) {
          toast('A matrícula precisa ter exatamente 6 dígitos.', 'error');
          return;
        }
        loading = true;
        submitBtn.disabled = true;
        mount(submitBtn, [spinner()]);
        try {
          await registerUser({ nomeCompleto: nameInput.value, matricula: matriculaInput.value, password: passInput.value });
          toast('Conta criada! Aguarde a aprovação do administrador.', 'ok', 5000);
        } catch (err) {
          toast(friendlyAuthError(err), 'error');
          loading = false;
          submitBtn.disabled = false;
          mount(submitBtn, ['Solicitar acesso']);
        }
      }
    },
    [
      field({ label: 'Nome completo', input: nameInput }),
      field({ label: 'Matrícula', input: matriculaInput, hint: 'Os 6 dígitos da sua matrícula na empresa.' }),
      field({ label: 'Senha', input: passInput, hint: 'Use ao menos 6 caracteres.' }),
      submitBtn
    ]
  );

  mount(root, [
    el('div', { class: 'auth-screen' }, [
      el('div', { class: 'auth-card' }, [
        brand('Criar novo acesso'),
        form,
        el('div', { class: 'auth-switch' }, [
          'Já tem conta? ',
          el('button', { type: 'button', onclick: onSwitch }, 'Entrar')
        ])
      ])
    ])
  ]);
}

export function renderStatusScreen(root, { status, nome }) {
  const isDenied = status === 'negado';
  mount(root, [
    el('div', { class: 'auth-screen' }, [
      el('div', { class: 'auth-card' }, [
        brand('Tempos & Métodos'),
        el('div', { class: 'auth-pending' }, [
          el('div', { html: icon.clock(38), style: { color: isDenied ? 'var(--danger-500)' : 'var(--accent-400)' } }),
          el('h3', {}, isDenied ? 'Acesso não autorizado' : `Olá, ${nome?.split(' ')[0] || ''}!`),
          el(
            'p',
            { style: { color: 'var(--text-2)', fontSize: '13.5px' } },
            isDenied
              ? 'Seu pedido de acesso foi negado pelo administrador. Fale com a coordenação da sua unidade para mais informações.'
              : 'Sua conta foi criada e está aguardando a aprovação de um administrador. Assim que for liberada, esta tela atualiza automaticamente.'
          ),
          button({ label: 'Sair', variant: 'outline', onClick: () => logoutUser() })
        ])
      ])
    ])
  ]);
}
