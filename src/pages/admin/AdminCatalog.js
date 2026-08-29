import { el, mount } from '../../utils/dom.js';
import { badge, button, emptyState, field, modal, segmented, switchToggle, cardWithHeader } from '../../components/ui.js';
import { icon } from '../../utils/icons.js';
import { addAtividade, updateAtividade, deleteAtividade } from '../../lib/activities.js';
import { addColaborador, updateColaborador, deleteColaborador } from '../../lib/collaborators.js';
import { toast } from '../../lib/toast.js';

export function renderCatalogPage(ctx) {
  let atividades = ctx.atividades;
  let colaboradores = ctx.colaboradores;
  let tab = 'atividades';
  const profile = ctx.profile;

  const tabs = segmented(
    [
      { value: 'atividades', label: 'Atividades & Improdutividades' },
      { value: 'colaboradores', label: 'Colaboradores' }
    ],
    tab,
    (v) => {
      tab = v;
      Array.from(tabs.children).forEach((b, i) => b.classList.toggle('active', ['atividades', 'colaboradores'][i] === v));
      paint();
    }
  );

  const body = el('div');
  const addBtn = button({ label: '', variant: 'primary', size: 'sm', icon: icon.plus(15), onClick: () => (tab === 'atividades' ? openAtividadeModal() : openColaboradorModal()) });

  const node = cardWithHeader({
    title: 'Cadastros',
    subtitle: 'Itens disponíveis para seleção no app mobile',
    actions: [tabs, addBtn],
    children: [body]
  });

  function paint() {
    mount(addBtn, [el('span', { html: icon.plus(15) }), tab === 'atividades' ? 'Nova atividade' : 'Novo colaborador']);
    if (tab === 'atividades') paintAtividades();
    else paintColaboradores();
  }

  function paintAtividades() {
    if (atividades.length === 0) {
      mount(body, [emptyState({ icon: icon.briefcase(38), title: 'Nenhuma atividade cadastrada', message: 'Cadastre as atividades e improdutividades que aparecerão no app.' })]);
      return;
    }
    const wrap = el('div', { class: 'table-wrap' });
    mount(wrap, [
      el('table', { class: 'data-table' }, [
        el('thead', {}, el('tr', {}, [el('th', {}, 'Nome'), el('th', {}, 'Tipo'), el('th', {}, 'Situação'), el('th', {}, 'Ações')])),
        el(
          'tbody',
          {},
          atividades.map((a) =>
            el('tr', {}, [
              el('td', { class: 'strong' }, a.nome),
              el('td', {}, badge(a.tipo === 'produtiva' ? 'Atividade' : 'Improdutividade', a.tipo === 'produtiva' ? 'info' : 'danger')),
              el('td', {}, switchToggle(a.ativo !== false, (val) => updateAtividade(a.id, { ativo: val }))),
              el('td', {}, rowActions(() => openAtividadeModal(a), () => removeItem(() => deleteAtividade(a.id), 'Atividade removida.')))
            ])
          )
        )
      ])
    ]);
    mount(body, [wrap]);
  }

  function paintColaboradores() {
    if (colaboradores.length === 0) {
      mount(body, [emptyState({ icon: icon.users(38), title: 'Nenhum colaborador cadastrado', message: 'Cadastre o time que poderá ser selecionado nos lançamentos.' })]);
      return;
    }
    const wrap = el('div', { class: 'table-wrap' });
    mount(wrap, [
      el('table', { class: 'data-table' }, [
        el('thead', {}, el('tr', {}, [el('th', {}, 'Nome completo'), el('th', {}, 'Matrícula'), el('th', {}, 'Situação'), el('th', {}, 'Ações')])),
        el(
          'tbody',
          {},
          colaboradores.map((c) =>
            el('tr', {}, [
              el('td', { class: 'strong' }, c.nomeCompleto),
              el('td', {}, c.matricula || '—'),
              el('td', {}, switchToggle(c.ativo !== false, (val) => updateColaborador(c.id, { ativo: val }))),
              el('td', {}, rowActions(() => openColaboradorModal(c), () => removeItem(() => deleteColaborador(c.id), 'Colaborador removido.')))
            ])
          )
        )
      ])
    ]);
    mount(body, [wrap]);
  }

  function rowActions(onEdit, onDelete) {
    return el('div', { class: 'toolbar' }, [
      button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.edit(15), onClick: onEdit }),
      button({ iconOnly: true, size: 'sm', variant: 'danger', icon: icon.trash(15), onClick: onDelete })
    ]);
  }

  function removeItem(fn, msg) {
    const close = () => backdrop.remove();
    const backdrop = modal({
      title: 'Remover item?',
      body: [el('p', { style: { fontSize: '13.5px', color: 'var(--text-1)' } }, 'Registros já lançados continuam com o nome preservado no histórico.')],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({
          label: 'Remover',
          variant: 'danger',
          onClick: async () => {
            try {
              await fn();
              toast(msg, 'ok');
            } catch {
              toast('Não foi possível remover.', 'error');
            }
            close();
          }
        })
      ],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  function openAtividadeModal(item) {
    const nomeInput = el('input', { class: 'input', type: 'text', value: item?.nome || '', placeholder: 'Ex.: Setup de máquina' });
    const tipoSelect = el('select', { class: 'select' }, [
      el('option', { value: 'produtiva', selected: !item || item.tipo === 'produtiva' }, 'Atividade (produtiva)'),
      el('option', { value: 'improdutiva', selected: item?.tipo === 'improdutiva' }, 'Improdutividade')
    ]);
    const close = () => backdrop.remove();
    const backdrop = modal({
      title: item ? 'Editar item' : 'Novo item',
      body: [field({ label: 'Nome', input: nomeInput }), field({ label: 'Tipo', input: tipoSelect })],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({
          label: 'Salvar',
          variant: 'primary',
          onClick: async () => {
            if (!nomeInput.value.trim()) return toast('Informe um nome.', 'error');
            try {
              if (item) await updateAtividade(item.id, { nome: nomeInput.value.trim(), tipo: tipoSelect.value });
              else await addAtividade({ nome: nomeInput.value, tipo: tipoSelect.value, criadoPor: profile.uid });
              toast('Salvo com sucesso.', 'ok');
              close();
            } catch {
              toast('Não foi possível salvar.', 'error');
            }
          }
        })
      ],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  function openColaboradorModal(item) {
    const nomeInput = el('input', { class: 'input', type: 'text', value: item?.nomeCompleto || '', placeholder: 'Nome completo' });
    const matriculaInput = el('input', { class: 'input', type: 'text', value: item?.matricula || '', placeholder: 'Opcional' });
    const close = () => backdrop.remove();
    const backdrop = modal({
      title: item ? 'Editar colaborador' : 'Novo colaborador',
      body: [field({ label: 'Nome completo', input: nomeInput }), field({ label: 'Matrícula', input: matriculaInput })],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({
          label: 'Salvar',
          variant: 'primary',
          onClick: async () => {
            if (!nomeInput.value.trim()) return toast('Informe o nome completo.', 'error');
            try {
              if (item) await updateColaborador(item.id, { nomeCompleto: nomeInput.value.trim(), matricula: matriculaInput.value.trim() });
              else await addColaborador({ nomeCompleto: nomeInput.value, matricula: matriculaInput.value, criadoPor: profile.uid });
              toast('Salvo com sucesso.', 'ok');
              close();
            } catch {
              toast('Não foi possível salvar.', 'error');
            }
          }
        })
      ],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  paint();

  return {
    node,
    update(newCtx) {
      atividades = newCtx.atividades;
      colaboradores = newCtx.colaboradores;
      paint();
    }
  };
}
