import { el, mount } from '../../utils/dom.js';
import { badge, button, emptyState, segmented, cardWithHeader, modal } from '../../components/ui.js';
import { icon } from '../../utils/icons.js';
import { initials } from '../../utils/format.js';
import { setUserStatus, setUserRole, setUserContratos, definirAdminPrincipal } from '../../lib/auth.js';
import { abrirRedefinirSenha, abrirAlterarMinhaSenha } from '../../components/Senha.js';
import { toast } from '../../lib/toast.js';

const STATUS_TONE = { pendente: 'warn', aprovado: 'ok', negado: 'danger' };
const STATUS_LABEL = { pendente: 'Pendente', aprovado: 'Aprovado', negado: 'Negado' };

export function renderUsersPage(ctx) {
  let usuarios = ctx.usuarios;
  let contratos = ctx.contratos || [];
  let principal = ctx.adminPrincipal || null;
  const eu = ctx.profile;
  let filter = 'pendente';

  const tabs = segmented(
    [
      { value: 'pendente', label: 'Pendentes' },
      { value: 'aprovado', label: 'Aprovados' },
      { value: 'negado', label: 'Negados' },
      { value: 'todos', label: 'Todos' }
    ],
    filter,
    (v) => {
      filter = v;
      Array.from(tabs.children).forEach((b, i) => b.classList.toggle('active', ['pendente', 'aprovado', 'negado', 'todos'][i] === v));
      paint();
    }
  );

  const body = el('div');
  const avisoPrincipal = el('div');
  const node = cardWithHeader({
    title: 'Controle de acesso',
    subtitle: 'Aprove ou negue solicitações de acesso ao REFRAMAX',
    actions: [tabs],
    children: [avisoPrincipal, body]
  });

  /** Enquanto ninguém é o administrador principal, convida o admin a proteger a própria conta. */
  function pintarAvisoPrincipal() {
    if (principal) return mount(avisoPrincipal, []);
    mount(avisoPrincipal, [el('div', { class: 'inline-alert info', style: { marginBottom: '16px', alignItems: 'center' } }, [
      el('span', { html: icon.shield(18), style: { display: 'inline-flex', flexShrink: '0' } }),
      el('div', { style: { flex: '1' } }, [
        el('strong', {}, 'Proteja sua conta de administrador'),
        el('div', {}, 'Torne sua conta o administrador principal: ninguém consegue tirar seu acesso, bloquear, mudar seu perfil ou sua senha pelo app.')
      ]),
      button({ label: 'Tornar minha conta principal', size: 'sm', variant: 'primary', icon: icon.lock(14), onClick: confirmarPrincipal })
    ])]);
  }

  function confirmarPrincipal() {
    const close = () => backdrop.remove();
    const backdrop = modal({
      title: 'Tornar sua conta o administrador principal?',
      body: [el('p', { style: { fontSize: '13.5px', lineHeight: '1.5' } }, `A conta de ${eu.nomeCompleto} (matrícula ${eu.matricula || '—'}) fica travada como administrador principal. Isso vale uma única vez e só pode ser desfeito no console do Firebase.`)],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({ label: 'Confirmar', variant: 'primary', icon: icon.lock(14), onClick: async () => {
          try {
            await definirAdminPrincipal(eu.uid);
            toast('Sua conta agora é o administrador principal.', 'ok');
            close();
          } catch {
            toast('Não foi possível. Confira se as regras novas do Firestore já foram publicadas.', 'error', 6000);
          }
        } })
      ],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  function act(fn, okMsg) {
    return async () => {
      try {
        await fn();
        toast(okMsg, 'ok');
      } catch {
        toast('Não foi possível concluir a ação.', 'error');
      }
    };
  }

  function paint() {
    pintarAvisoPrincipal();
    const list = filter === 'todos' ? usuarios : usuarios.filter((u) => u.status === filter);
    if (list.length === 0) {
      mount(body, [emptyState({ icon: icon.users(38), title: 'Nada por aqui', message: 'Nenhum usuário nesta categoria.' })]);
      return;
    }

    const wrap = el('div', { class: 'table-wrap' });
    const table = el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, [el('th', {}, 'Usuário'), el('th', {}, 'Matrícula'), el('th', {}, 'Papel'), el('th', {}, 'Contratos'), el('th', {}, 'Status'), el('th', {}, 'Ações')])),
      el(
        'tbody',
        {},
        list.map((u) =>
          el('tr', {}, [
            el('td', { class: 'strong' }, [
              el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '10px' } }, [
                el('span', { class: 'avatar' }, initials(u.nomeCompleto)),
                u.nomeCompleto || '—'
              ])
            ]),
            el('td', { class: 'mono' }, u.matricula || '—'),
            el('td', {}, roleSelect(u)),
            el('td', {}, contratosCell(u)),
            el('td', {}, badge(STATUS_LABEL[u.status] || u.status, STATUS_TONE[u.status] || 'neutral', true)),
            el('td', {}, actionsFor(u))
          ])
        )
      )
    ]);
    mount(wrap, [table]);
    mount(body, [wrap]);
  }

  function roleSelect(u) {
    if (u.uid === principal) {
      return el('span', { class: 'badge-principal', title: 'Conta fixa: não pode ser alterada pelo app' }, [el('span', { html: icon.lock(13), style: { display: 'inline-flex' } }), 'Administrador principal']);
    }
    return el(
      'select',
      {
        class: 'select',
        style: { height: '34px', fontSize: '12.5px', minWidth: '150px' },
        onchange: async (e) => {
          try {
            await setUserRole(u.uid, e.target.value);
            toast('Papel atualizado.', 'ok');
          } catch {
            toast('Não foi possível atualizar o papel.', 'error');
          }
        },
        // ninguém muda o próprio papel (evita se trancar fora do painel)
        disabled: u.status !== 'aprovado' || u.uid === eu.uid
      },
      [
        el('option', { value: 'lider', selected: u.role === 'lider' }, 'Apontador (celular)'),
        el('option', { value: 'planejador', selected: u.role === 'planejador' }, 'Planejador'),
        el('option', { value: 'admin', selected: u.role === 'admin' }, 'Administrador')
      ]
    );
  }

  /** Permissão por contrato: vale para o apontador (planejador e admin veem tudo). */
  function contratosCell(u) {
    if (u.uid === principal || u.role === 'admin' || u.role === 'planejador') return el('span', { class: 'muted', style: { fontSize: '12.5px' } }, 'Todos');
    const ids = u.contratos || [];
    const nomes = ids.map((id) => contratos.find((c) => c.id === id)?.nome).filter(Boolean);
    return el('button', { class: 'chip', type: 'button', style: { height: '30px', fontSize: '12.5px' }, disabled: u.status !== 'aprovado', onclick: () => editarContratos(u) },
      ids.length ? (nomes.length <= 2 ? nomes.join(', ') : `${nomes.length} contratos`) : 'Todos');
  }

  function editarContratos(u) {
    const marcados = new Set(u.contratos || []);
    const close = () => backdrop.remove();
    const backdrop = modal({
      title: `Contratos de ${u.nomeCompleto}`,
      body: [
        el('p', { style: { fontSize: '13px', color: 'var(--text-2)' } }, 'Marque os contratos em que esta pessoa trabalha. Ela só verá os projetos deles no celular. Sem nenhum marcado, vê todos.'),
        contratos.length
          ? el('div', { class: 'check-list' }, contratos.map((c) => el('label', { class: 'check-item' }, [
              el('input', { type: 'checkbox', checked: marcados.has(c.id), onchange: (e) => (e.target.checked ? marcados.add(c.id) : marcados.delete(c.id)) }),
              el('span', {}, `${c.nome} · ${c.clienteNome}`)
            ])))
          : el('p', { class: 'muted' }, 'Nenhum contrato cadastrado ainda (cadastre em Projetos).')
      ],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({ label: 'Salvar', variant: 'primary', onClick: async () => {
          try {
            await setUserContratos(u.uid, [...marcados].slice(0, 30));
            toast('Contratos atualizados.', 'ok');
            close();
          } catch {
            toast('Não foi possível salvar.', 'error');
          }
        } })
      ],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  function actionsFor(u) {
    if (u.uid === eu.uid) {
      return button({ label: 'Alterar minha senha', size: 'sm', variant: 'outline', icon: icon.key(14), onClick: abrirAlterarMinhaSenha });
    }
    if (u.uid === principal) return el('span', { class: 'muted', style: { fontSize: '12.5px' } }, 'Conta protegida');
    return el('div', { class: 'toolbar' }, [
      acessoFor(u),
      button({ label: 'Senha', size: 'sm', variant: 'ghost', icon: icon.key(14), onClick: () => abrirRedefinirSenha(u) })
    ]);
  }

  function acessoFor(u) {
    if (u.status === 'pendente') {
      return el('div', { class: 'toolbar' }, [
        button({ label: 'Aprovar', size: 'sm', variant: 'primary', icon: icon.check(14), onClick: act(() => setUserStatus(u.uid, 'aprovado'), 'Acesso aprovado.') }),
        button({ label: 'Negar', size: 'sm', variant: 'danger', icon: icon.x(14), onClick: act(() => setUserStatus(u.uid, 'negado'), 'Acesso negado.') })
      ]);
    }
    if (u.status === 'aprovado') {
      return button({ label: 'Revogar acesso', size: 'sm', variant: 'danger', onClick: act(() => setUserStatus(u.uid, 'negado'), 'Acesso revogado.') });
    }
    return button({ label: 'Reativar', size: 'sm', variant: 'outline', onClick: act(() => setUserStatus(u.uid, 'aprovado'), 'Acesso liberado.') });
  }

  paint();

  return {
    node,
    update(newCtx) {
      usuarios = newCtx.usuarios;
      contratos = newCtx.contratos || [];
      principal = newCtx.adminPrincipal || null;
      paint();
    }
  };
}
