import { el, mount } from '../utils/dom.js';
import { field, button, spinner } from '../components/ui.js';
import { icon } from '../utils/icons.js';
import { loginUser, registerUser, friendlyAuthError, logoutUser, isMatriculaValida } from '../lib/auth.js';
import { toast } from '../lib/toast.js';

function brand() {
  return el('div', { class: 'auth-brand' }, [
    el('div', { class: 'brand-word brand-word-lg' }, 'REFRAMAX'),
    el('div', { class: 'brand-tag brand-tag-lg' }, 'Tempos & Métodos')
  ]);
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
        brand(),
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
        brand(),
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
        brand(),
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
