import { el, mount } from '../../utils/dom.js';
import { badge, button, emptyState, field, modal, switchToggle, cardWithHeader } from '../../components/ui.js';
import { icon } from '../../utils/icons.js';
import { addSetor, updateSetor, deleteSetor } from '../../lib/setores.js';
import { ESCALAS, escalaInfo, escalaLabel, capacidadeMinutosSetor, formatMinutes, todayISO } from '../../utils/format.js';
import { toast } from '../../lib/toast.js';

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

export function renderSetoresPage(ctx) {
  let setores = ctx.setores;
  const profile = ctx.profile;

  const body = el('div');
  const addBtn = button({ label: 'Novo setor', variant: 'primary', size: 'sm', icon: icon.plus(15), onClick: () => openModal() });

  const node = cardWithHeader({
    title: 'Setores da planta',
    subtitle: 'Cada área da Ternium onde a Reframax atua — turno, jornada e turmas definem a capacidade usada nos indicadores',
    actions: [addBtn],
    children: [body]
  });

  function paint() {
    if (setores.length === 0) {
      mount(body, [
        emptyState({
          icon: icon.building(38),
          title: 'Nenhum setor configurado',
          message: 'Cadastre os setores (ex.: Coqueria, Alto-Forno) e a escala de turno de cada um para habilitar os indicadores de ocupação.'
        })
      ]);
      return;
    }
    // capacidade estimada dos últimos 30 dias, só pra dar uma referência tangível
    const from = isoDaysAgo(29);
    const to = todayISO();
    const wrap = el('div', { class: 'table-wrap' });
    mount(wrap, [
      el('table', { class: 'data-table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', {}, 'Setor'), el('th', {}, 'Escala'), el('th', {}, 'Jornada'), el('th', {}, 'Turmas'),
          el('th', {}, 'Capacidade (30 dias)'), el('th', {}, 'Situação'), el('th', {}, 'Ações')
        ])),
        el('tbody', {}, setores.map((s) =>
          el('tr', {}, [
            el('td', { class: 'strong' }, s.nome),
            el('td', {}, badge(escalaLabel(s.escala), 'info')),
            el('td', { class: 'mono' }, `${s.horasPorTurno || escalaInfo(s.escala).horasPadrao}h`),
            el('td', { class: 'mono' }, String(s.turmas || 1)),
            el('td', { class: 'mono' }, formatMinutes(capacidadeMinutosSetor(s, from, to))),
            el('td', {}, switchToggle(s.ativo !== false, (val) => updateSetor(s.id, { ativo: val }))),
            el('td', {}, el('div', { class: 'toolbar' }, [
              button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.edit(15), onClick: () => openModal(s) }),
              button({ iconOnly: true, size: 'sm', variant: 'danger', icon: icon.trash(15), onClick: () => confirmDelete(s) })
            ]))
          ])
        ))
      ])
    ]);
    mount(body, [wrap]);
  }

  function confirmDelete(s) {
    const close = () => backdrop.remove();
    const backdrop = modal({
      title: 'Remover setor?',
      body: [el('p', { style: { fontSize: '13.5px', color: 'var(--text-1)' } }, 'Lançamentos já feitos nesse setor continuam no histórico com o nome preservado.')],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({ label: 'Remover', variant: 'danger', onClick: async () => {
          try { await deleteSetor(s.id, s.nome); toast('Setor removido.', 'ok'); } catch { toast('Não foi possível remover.', 'error'); }
          close();
        } })
      ],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  function openModal(item) {
    const nomeInput = el('input', { class: 'input', type: 'text', value: item?.nome || '', placeholder: 'Ex.: Coqueria' });
    const escalaSelect = el('select', { class: 'select' }, ESCALAS.map((e) =>
      el('option', { value: e.value, selected: (item?.escala || 'adm') === e.value }, e.label)
    ));
    const horasInput = el('input', { class: 'input mono', type: 'number', min: '1', max: '24', step: '1', value: String(item?.horasPorTurno || escalaInfo(item?.escala || 'adm').horasPadrao) });
    const turmasInput = el('input', { class: 'input mono', type: 'number', min: '1', step: '1', value: String(item?.turmas || 1) });

    // ao trocar a escala, sugere a jornada típica dela (sem sobrescrever se o
    // usuário já digitou algo diferente de propósito? mantém simples: atualiza)
    escalaSelect.addEventListener('change', () => {
      horasInput.value = String(escalaInfo(escalaSelect.value).horasPadrao);
    });

    const close = () => backdrop.remove();
    const backdrop = modal({
      title: item ? 'Editar setor' : 'Novo setor',
      body: [
        field({ label: 'Nome do setor', input: nomeInput }),
        field({ label: 'Escala de turno', input: escalaSelect, hint: 'Define quantos dias do ciclo têm trabalho — base do cálculo de capacidade.' }),
        el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }, [
          field({ label: 'Jornada (horas/turno)', input: horasInput }),
          field({ label: 'Turmas simultâneas', input: turmasInput, hint: 'Equipes ao mesmo tempo.' })
        ])
      ],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({ label: 'Salvar', variant: 'primary', onClick: async () => {
          if (!nomeInput.value.trim()) return toast('Informe o nome do setor.', 'error');
          const payload = {
            nome: nomeInput.value.trim(),
            escala: escalaSelect.value,
            horasPorTurno: Math.max(1, Math.round(Number(horasInput.value) || escalaInfo(escalaSelect.value).horasPadrao)),
            turmas: Math.max(1, Math.round(Number(turmasInput.value) || 1))
          };
          try {
            if (item) await updateSetor(item.id, payload);
            else await addSetor({ ...payload, criadoPor: profile.uid });
            toast('Setor salvo.', 'ok');
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

  paint();

  return {
    node,
    update(newCtx) {
      setores = newCtx.setores;
      paint();
    }
  };
}
