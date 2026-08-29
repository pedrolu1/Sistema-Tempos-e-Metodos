import { el, mount } from '../../utils/dom.js';
import { badge, button, emptyState, segmented, cardWithHeader } from '../../components/ui.js';
import { icon } from '../../utils/icons.js';
import { initials } from '../../utils/format.js';
import { setUserStatus, setUserRole } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';

const STATUS_TONE = { pendente: 'warn', aprovado: 'ok', negado: 'danger' };
const STATUS_LABEL = { pendente: 'Pendente', aprovado: 'Aprovado', negado: 'Negado' };

export function renderUsersPage(ctx) {
  let usuarios = ctx.usuarios;
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
  const node = cardWithHeader({
    title: 'Controle de acesso',
    subtitle: 'Aprove ou negue solicitações de acesso ao CRONOS',
    actions: [tabs],
    children: [body]
  });

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
    const list = filter === 'todos' ? usuarios : usuarios.filter((u) => u.status === filter);
    if (list.length === 0) {
      mount(body, [emptyState({ icon: icon.users(38), title: 'Nada por aqui', message: 'Nenhum usuário nesta categoria.' })]);
      return;
    }

    const wrap = el('div', { class: 'table-wrap' });
    const table = el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, [el('th', {}, 'Usuário'), el('th', {}, 'E-mail'), el('th', {}, 'Papel'), el('th', {}, 'Status'), el('th', {}, 'Ações')])),
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
            el('td', {}, u.email || '—'),
            el('td', {}, roleSelect(u)),
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
    return el(
      'select',
      {
        class: 'select',
        style: { height: '34px', fontSize: '12.5px', minWidth: '120px' },
        onchange: async (e) => {
          try {
            await setUserRole(u.uid, e.target.value);
            toast('Papel atualizado.', 'ok');
          } catch {
            toast('Não foi possível atualizar o papel.', 'error');
          }
        },
        disabled: u.status !== 'aprovado'
      },
      [
        el('option', { value: 'lider', selected: u.role === 'lider' }, 'Líder (mobile)'),
        el('option', { value: 'admin', selected: u.role === 'admin' }, 'Administrador')
      ]
    );
  }

  function actionsFor(u) {
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
      paint();
    }
  };
}
