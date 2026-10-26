import { el, mount } from '../utils/dom.js';
import { button, field, modal, segmented, credito } from './ui.js';
import { icon } from '../utils/icons.js';
import { alterarMinhaSenha, concluirTrocaDeSenha, redefinirSenhaDe, friendlyAuthError, logoutUser } from '../lib/auth.js';
import { toast } from '../lib/toast.js';

const campoSenha = (placeholder) => el('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder });

/** Confere a senha nova; devolve a mensagem do problema ou null. */
function problemaNaSenha(nova, confirmacao) {
  if (nova.length < 6) return 'A senha nova precisa ter pelo menos 6 caracteres.';
  if (nova.length > 64) return 'A senha nova pode ter no máximo 64 caracteres.';
  if (nova !== confirmacao) return 'A confirmação não é igual à senha nova.';
  return null;
}

/** Qualquer pessoa troca a própria senha (painel e celular). */
export function abrirAlterarMinhaSenha() {
  const atual = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Sua senha de hoje' });
  const nova = campoSenha('Pelo menos 6 caracteres');
  const confirmacao = campoSenha('Repita a senha nova');
  const close = () => backdrop.remove();
  const salvar = button({ label: 'Trocar senha', variant: 'primary', onClick: async () => {
    if (!atual.value) return toast('Digite a senha atual.', 'error');
    const problema = problemaNaSenha(nova.value, confirmacao.value);
    if (problema) return toast(problema, 'error');
    if (nova.value === atual.value) return toast('A senha nova precisa ser diferente da atual.', 'error');
    salvar.disabled = true;
    try {
      await alterarMinhaSenha(atual.value, nova.value);
      toast('Senha trocada. Use a nova no próximo acesso.', 'ok');
      close();
    } catch (err) {
      salvar.disabled = false;
      toast(err.code === 'senha-atual' ? 'A senha atual não confere.' : friendlyAuthError(err), 'error');
    }
  } });
  const backdrop = modal({
    title: 'Alterar minha senha',
    body: [field({ label: 'Senha atual', input: atual }), field({ label: 'Senha nova', input: nova }), field({ label: 'Confirme a senha nova', input: confirmacao })],
    footer: [button({ label: 'Cancelar', variant: 'ghost', onClick: close }), salvar],
    onClose: close
  });
  document.body.appendChild(backdrop);
  atual.focus();
}

/** Tela obrigatória depois que o administrador redefiniu a senha. */
export function renderNovaSenha(root, { nome, aoConcluir }) {
  const nova = campoSenha('Pelo menos 6 caracteres');
  const confirmacao = campoSenha('Repita a senha nova');
  const salvar = button({ label: 'Salvar e entrar', variant: 'primary', block: true, onClick: async () => {
    const problema = problemaNaSenha(nova.value, confirmacao.value);
    if (problema) return toast(problema, 'error');
    salvar.disabled = true;
    try {
      await concluirTrocaDeSenha(nova.value);
      toast('Senha nova salva.', 'ok');
      aoConcluir();
    } catch (err) {
      salvar.disabled = false;
      toast(friendlyAuthError(err), 'error');
    }
  } });
  mount(root, [
    el('div', { class: 'auth-screen' }, [
      el('div', { class: 'auth-card' }, [
        el('div', { class: 'auth-pending' }, [
          el('div', { html: icon.key(36), style: { color: 'var(--accent-400)' } }),
          el('h3', {}, `${nome ? `${nome.split(' ')[0]}, crie` : 'Crie'} sua senha nova`),
          el('p', { style: { color: 'var(--text-2)', fontSize: '13.5px' } }, 'Você entrou com uma senha provisória. Escolha uma senha só sua para continuar.')
        ]),
        el('div', { class: 'auth-form' }, [field({ label: 'Senha nova', input: nova }), field({ label: 'Confirme a senha nova', input: confirmacao }), salvar]),
        el('div', { class: 'auth-switch' }, [el('button', { type: 'button', onclick: () => logoutUser() }, 'Sair')]),
        credito()
      ])
    ])
  ]);
  nova.focus();
}

const ERROS_REDEFINIR = {
  'nao-configurado': 'A redefinição de senha ainda não foi ativada: falta colocar a chave do Firebase na Netlify (passo a passo no README).',
  'credencial-invalida': 'A chave do Firebase colocada na Netlify não é válida. Gere outra e cole de novo.',
  principal: 'A conta do administrador principal não pode ser alterada.',
  'propria-conta': 'Para a sua própria senha, use "Alterar minha senha".',
  'sem-permissao': 'Só administradores podem redefinir senhas.',
  sessao: 'Sua sessão expirou. Saia e entre de novo.',
  'senha-fraca': 'A senha precisa ter entre 6 e 64 caracteres.',
  usuario: 'Usuário não encontrado.',
  rede: 'Sem conexão. Tente de novo com internet.'
};

/** O administrador redefine (senha provisória) ou define a senha de outra pessoa. */
export function abrirRedefinirSenha(u) {
  let modo = 'provisoria';
  const definida = campoSenha('Pelo menos 6 caracteres');
  const exigir = el('input', { type: 'checkbox', checked: true });
  const extra = el('div');
  const pintarModo = () => mount(extra, modo === 'provisoria'
    ? [el('p', { class: 'muted', style: { fontSize: '13px' } }, 'O app gera uma senha provisória para você entregar à pessoa. No próximo acesso, ela cria uma senha só dela.')]
    : [
        field({ label: 'Senha nova', input: definida }),
        el('label', { class: 'check-item' }, [exigir, el('span', {}, 'Pedir para a pessoa criar uma senha só dela no próximo acesso')])
      ]);
  const abas = segmented([{ value: 'provisoria', label: 'Gerar senha provisória' }, { value: 'definir', label: 'Definir uma senha' }], modo, (v) => {
    modo = v;
    Array.from(abas.children).forEach((b, i) => b.classList.toggle('active', i === (v === 'provisoria' ? 0 : 1)));
    pintarModo();
  });
  pintarModo();

  const close = () => backdrop.remove();
  const confirmar = button({ label: 'Redefinir senha', variant: 'primary', icon: icon.key(15), onClick: async () => {
    const novaSenha = modo === 'definir' ? definida.value : '';
    if (modo === 'definir' && (novaSenha.length < 6 || novaSenha.length > 64)) return toast('A senha precisa ter entre 6 e 64 caracteres.', 'error');
    confirmar.disabled = true;
    try {
      const gerada = await redefinirSenhaDe(u.uid, { novaSenha, exigirTroca: modo === 'provisoria' || exigir.checked });
      close();
      mostrarResultado(u, gerada);
    } catch (err) {
      confirmar.disabled = false;
      toast(ERROS_REDEFINIR[err.code] || 'Não foi possível redefinir a senha.', 'error', 6000);
    }
  } });
  const backdrop = modal({
    title: `Senha de ${u.nomeCompleto || 'usuário'}`,
    body: [
      abas,
      extra,
      el('p', { class: 'muted', style: { fontSize: '12px' } }, 'Se a pessoa estiver com o app aberto, ela precisará entrar de novo. Lançamentos guardados no celular não se perdem.')
    ],
    footer: [button({ label: 'Cancelar', variant: 'ghost', onClick: close }), confirmar],
    onClose: close
  });
  document.body.appendChild(backdrop);
}

function mostrarResultado(u, gerada) {
  const close = () => backdrop.remove();
  const copiar = () => {
    navigator.clipboard?.writeText(gerada).then(() => toast('Senha copiada.', 'ok'), () => toast('Copie a senha manualmente.', 'info'));
  };
  const backdrop = modal({
    title: 'Senha redefinida',
    body: gerada
      ? [
          el('p', { style: { fontSize: '13.5px' } }, `Entregue esta senha provisória a ${u.nomeCompleto || 'pessoa'} (matrícula ${u.matricula || '—'}):`),
          el('div', { class: 'senha-provisoria mono' }, gerada),
          el('p', { class: 'muted', style: { fontSize: '12.5px' } }, 'Ela não aparece de novo depois que você fechar esta janela. No primeiro acesso, a pessoa cria uma senha só dela.')
        ]
      : [el('p', { style: { fontSize: '13.5px' } }, `A senha de ${u.nomeCompleto || 'usuário'} foi alterada.`)],
    footer: [gerada ? button({ label: 'Copiar', variant: 'outline', icon: icon.key(14), onClick: copiar }) : null, button({ label: 'Fechar', variant: 'primary', onClick: close })].filter(Boolean),
    onClose: close
  });
  document.body.appendChild(backdrop);
}
