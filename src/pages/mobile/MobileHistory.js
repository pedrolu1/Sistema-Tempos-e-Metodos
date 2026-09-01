import { el, mount } from '../../utils/dom.js';
import { badge, button, emptyState, field, modal } from '../../components/ui.js';
import { efetivoInputs } from '../../components/EfetivoInputs.js';
import { icon } from '../../utils/icons.js';
import { formatDateBR, formatMinutes, weekdayShort, efetivoTotal, formatEfetivo } from '../../utils/format.js';
import { updateLancamento, deleteLancamento } from '../../lib/records.js';
import { toast } from '../../lib/toast.js';

export function renderHistoryPage({ lancamentos, atividades }) {
  const root = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });

  function refresh(list) {
    lancamentos = list;
    paint();
  }

  function paint() {
    if (lancamentos.length === 0) {
      mount(root, [
        emptyState({
          icon: icon.list(40),
          title: 'Nenhum lançamento ainda',
          message: 'Os registros que você criar na aba Lançar aparecem aqui.'
        })
      ]);
      return;
    }

    mount(
      root,
      lancamentos.map((l) => itemCard(l))
    );
  }

  function itemCard(l) {
    const synced = l._sincronizado;
    const isImprodutiva = l.tipoRegistro === 'improdutividade';
    return el('div', { class: 'card card-pad', style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' } }, [
        el('div', {}, [
          el('div', { style: { fontSize: '11.5px', color: 'var(--text-2)', fontWeight: '600', textTransform: 'uppercase' } }, `${weekdayShort(l.data)} · ${formatDateBR(l.data)}`),
          el('div', { style: { fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '14.5px', marginTop: '2px' } }, l.atividadeNome || '—')
        ]),
        badge(synced ? 'Sincronizado' : 'Pendente', synced ? 'ok' : 'warn', true)
      ]),
      el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '13px', color: 'var(--text-1)' } }, [
        rowInfo(icon.clock(14), `${l.horaInicio}–${l.horaTermino} (${formatMinutes(l.duracaoMinutos)})`),
        efetivoTotal(l.efetivo) > 0 ? el('span', { title: formatEfetivo(l.efetivo) }, rowInfo(icon.crew(14), `Efetivo: ${efetivoTotal(l.efetivo)}`)) : null
      ]),
      badge(isImprodutiva ? 'Improdutividade' : 'Atividade', isImprodutiva ? 'danger' : 'info'),
      el('div', { style: { display: 'flex', gap: '8px', marginTop: '2px' } }, [
        synced
          ? el('span', { style: { fontSize: '12px', color: 'var(--text-3)' } }, 'Editável apenas pelo administrador após a sincronização.')
          : el('div', { style: { display: 'flex', gap: '8px', width: '100%' } }, [
              button({ label: 'Editar', variant: 'outline', size: 'sm', icon: icon.edit(14), onClick: () => openEdit(l) }),
              button({ label: 'Excluir', variant: 'danger', size: 'sm', icon: icon.trash(14), onClick: () => confirmDelete(l) })
            ])
      ])
    ]);
  }

  function rowInfo(iconHtml, text) {
    return el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } }, [
      el('span', { html: iconHtml, style: { display: 'inline-flex', color: 'var(--text-3)' } }),
      text
    ]);
  }

  function confirmDelete(l) {
    const close = () => backdrop.remove();
    const backdrop = modal({
      title: 'Excluir lançamento?',
      body: [el('p', { style: { color: 'var(--text-1)', fontSize: '13.5px' } }, 'Esta ação não pode ser desfeita.')],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({
          label: 'Excluir',
          variant: 'danger',
          onClick: async () => {
            try {
              await deleteLancamento(l.id);
              toast('Lançamento excluído.', 'ok');
            } catch {
              toast('Não foi possível excluir.', 'error');
            }
            close();
          }
        })
      ],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  function openEdit(l) {
    let tipoRegistro = l.tipoRegistro;

    const dataInput = el('input', { class: 'input', type: 'date', value: l.data });
    const inicioInput = el('input', { class: 'input', type: 'time', value: l.horaInicio });
    const terminoInput = el('input', { class: 'input', type: 'time', value: l.horaTermino });
    const obsInput = el('textarea', { class: 'textarea', value: l.observacoes || '' });

    const atividadeWrap = el('div');
    const efetivo = efetivoInputs(l.efetivo || {});

    function buildAtividade() {
      const opts = atividades.filter((a) => a.ativo !== false && a.tipo === (tipoRegistro === 'atividade' ? 'produtiva' : 'improdutiva'));
      mount(atividadeWrap, [
        el('select', { class: 'select' }, [
          el('option', { value: '' }, 'Selecione…'),
          ...opts.map((a) => el('option', { value: a.id, selected: a.id === l.atividadeId }, a.nome))
        ])
      ]);
    }
    buildAtividade();

    const close = () => backdrop.remove();
    const backdrop = modal({
      title: 'Editar lançamento',
      body: [
        el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }, [
          field({ label: 'Início', input: inicioInput }),
          field({ label: 'Término', input: terminoInput })
        ]),
        field({ label: 'Data', input: dataInput }),
        field({ label: tipoRegistro === 'atividade' ? 'Atividade' : 'Improdutividade', input: atividadeWrap }),
        field({ label: 'Efetivo utilizado', input: efetivo.node }),
        field({ label: 'Observações', input: obsInput })
      ],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({
          label: 'Salvar alterações',
          variant: 'primary',
          onClick: async () => {
            const atividadeId = atividadeWrap.querySelector('select').value;
            const atividade = atividades.find((a) => a.id === atividadeId);
            if (!atividadeId) {
              toast('Preencha todos os campos obrigatórios.', 'error');
              return;
            }
            try {
              await updateLancamento(l.id, {
                data: dataInput.value,
                horaInicio: inicioInput.value,
                horaTermino: terminoInput.value,
                tipoRegistro,
                contrato: l.contrato || '',
                atividadeId,
                atividadeNome: atividade?.nome || '',
                atividadeTipo: atividade?.tipo || '',
                liderId: l.liderId || '',
                liderNome: l.liderNome || '',
                colaboradoresIds: l.colaboradoresIds || [],
                colaboradoresNomes: l.colaboradoresNomes || [],
                efetivo: efetivo.getValue(),
                observacoes: obsInput.value
              });
              toast('Lançamento atualizado.', 'ok');
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
  return { node: root, refresh };
}
