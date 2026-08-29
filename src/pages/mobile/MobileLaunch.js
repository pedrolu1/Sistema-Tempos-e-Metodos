import { el, mount } from '../../utils/dom.js';
import { field, button, segmented, card } from '../../components/ui.js';
import { liderSelect, colaboradoresPicker } from '../../components/PeoplePicker.js';
import { icon } from '../../utils/icons.js';
import { todayISO, nowHHMM } from '../../utils/format.js';
import { createLancamento } from '../../lib/records.js';
import { toast } from '../../lib/toast.js';

export function renderLaunchPage({ colaboradores, atividades, profile }) {
  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } });
  buildForm();
  return wrap;

  function buildForm() {
    let tipoRegistro = 'atividade';
    let liderId = '';
    let colaboradoresIds = [];
    let submitting = false;

    const dataInput = el('input', { class: 'input', type: 'date', value: todayISO(), required: true });
    const inicioInput = el('input', { class: 'input', type: 'time', value: nowHHMM(), required: true });
    const terminoInput = el('input', { class: 'input', type: 'time', required: true });
    const obsInput = el('textarea', { class: 'textarea', placeholder: 'Observações (opcional)' });

    const atividadeSelectWrap = el('div');
    const liderWrap = el('div');
    const colaboradoresWrap = el('div');

    function activeAtividades() {
      return atividades.filter((a) => a.ativo !== false && a.tipo === (tipoRegistro === 'atividade' ? 'produtiva' : 'improdutiva'));
    }

    function buildAtividadeSelect() {
      const opts = activeAtividades();
      mount(atividadeSelectWrap, [
        el(
          'select',
          { class: 'select', required: true },
          [
            el('option', { value: '' }, opts.length ? `Selecione a ${tipoRegistro === 'atividade' ? 'atividade' : 'improdutividade'}…` : 'Nenhuma cadastrada — peça ao admin'),
            ...opts.map((a) => el('option', { value: a.id }, a.nome))
          ]
        )
      ]);
    }

    function buildLider() {
      mount(liderWrap, [
        liderSelect({
          options: colaboradores.filter((c) => c.ativo !== false),
          value: liderId,
          onChange: (val) => {
            liderId = val;
            colaboradoresIds = colaboradoresIds.filter((id) => id !== liderId);
            buildColaboradores();
          }
        })
      ]);
    }

    function buildColaboradores() {
      mount(colaboradoresWrap, [
        colaboradoresPicker({
          options: colaboradores.filter((c) => c.ativo !== false),
          selected: colaboradoresIds,
          excludeId: liderId || undefined,
          onChange: (ids) => {
            colaboradoresIds = ids;
          }
        })
      ]);
    }

    buildAtividadeSelect();
    buildLider();
    buildColaboradores();

    const tipoTabs = segmented(
      [
        { value: 'atividade', label: 'Atividade' },
        { value: 'improdutividade', label: 'Improdutividade' }
      ],
      tipoRegistro,
      (val) => {
        tipoRegistro = val;
        Array.from(tipoTabs.children).forEach((btn, i) => btn.classList.toggle('active', i === (val === 'atividade' ? 0 : 1)));
        buildAtividadeSelect();
      }
    );

    const submitBtn = button({ label: 'Registrar lançamento', variant: 'primary', size: 'lg', block: true, type: 'submit', icon: icon.check(18) });

    const form = el(
      'form',
      {
        style: { display: 'flex', flexDirection: 'column', gap: '16px' },
        onsubmit: async (e) => {
          e.preventDefault();
          if (submitting) return;

          const atividadeSelect = atividadeSelectWrap.querySelector('select');
          const atividadeId = atividadeSelect.value;
          const atividade = atividades.find((a) => a.id === atividadeId);

          if (!dataInput.value || !inicioInput.value || !terminoInput.value) {
            toast('Preencha data, horário de início e término.', 'error');
            return;
          }
          if (!atividadeId) {
            toast(`Selecione a ${tipoRegistro === 'atividade' ? 'atividade' : 'improdutividade'}.`, 'error');
            return;
          }
          if (!liderId) {
            toast('Selecione o líder da atividade.', 'error');
            return;
          }
          if (colaboradoresIds.length === 0) {
            toast('Selecione ao menos um colaborador.', 'error');
            return;
          }

          submitting = true;
          submitBtn.disabled = true;

          const lider = colaboradores.find((c) => c.id === liderId);
          const colaboradoresNomes = colaboradoresIds.map((id) => colaboradores.find((c) => c.id === id)?.nomeCompleto || '');

          try {
            await createLancamento({
              data: dataInput.value,
              horaInicio: inicioInput.value,
              horaTermino: terminoInput.value,
              tipoRegistro,
              atividadeId,
              atividadeNome: atividade?.nome || '',
              atividadeTipo: atividade?.tipo || '',
              liderId,
              liderNome: lider?.nomeCompleto || '',
              colaboradoresIds,
              colaboradoresNomes,
              observacoes: obsInput.value,
              criadoPorUid: profile.uid,
              criadoPorNome: profile.nomeCompleto
            });
            toast('Lançamento registrado! Ele sincroniza automaticamente.', 'ok');
            mount(wrap, []);
            buildForm();
          } catch (err) {
            toast('Não foi possível registrar. Tente novamente.', 'error');
            submitting = false;
            submitBtn.disabled = false;
          }
        }
      },
      [
        el('div', { class: 'grid', style: { gridTemplateColumns: '1fr', gap: '14px' } }, [
          field({ label: 'Data', input: dataInput }),
          el('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', gap: '14px' } }, [
            field({ label: 'Início', input: inicioInput }),
            field({ label: 'Término', input: terminoInput })
          ])
        ]),
        el('div', { class: 'field' }, [el('label', { class: 'field-label' }, 'O que está sendo registrado?'), tipoTabs]),
        field({ label: tipoRegistro === 'atividade' ? 'Atividade em execução' : 'Improdutividade em execução', input: atividadeSelectWrap }),
        field({ label: 'Líder da atividade', input: liderWrap }),
        field({ label: 'Colaboradores', input: colaboradoresWrap }),
        field({ label: 'Observações', input: obsInput }),
        submitBtn
      ]
    );

    mount(wrap, [
      card([
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' } }, [
          el('span', { html: icon.bolt(18), style: { color: 'var(--accent-400)' } }),
          el('strong', { style: { fontFamily: 'var(--font-display)', fontSize: '14px' } }, 'Novo lançamento')
        ]),
        form
      ])
    ]);
  }
}
