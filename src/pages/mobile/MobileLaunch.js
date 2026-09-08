import { el, mount } from '../../utils/dom.js';
import { field, button, segmented, card } from '../../components/ui.js';
import { efetivoInputs } from '../../components/EfetivoInputs.js';
import { icon } from '../../utils/icons.js';
import { todayISO, nowHHMM, durationMinutes, formatMinutes, efetivoExcedido, efetivoTotal } from '../../utils/format.js';
import { createLancamento } from '../../lib/records.js';
import { toast } from '../../lib/toast.js';

function sectionTitle(text, first = false) {
  return el('div', { class: 'section-title', style: { marginTop: first ? '0' : '4px' } }, text);
}

/** Soma minutos a um horário HH:MM, com virada de dia (volta pro começo). */
function somaHHMM(hhmm, min) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  let t = (h * 60 + m + min) % (24 * 60);
  if (t < 0) t += 24 * 60;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function renderLaunchPage({ atividades, setores = [], profile }) {
  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } });
  buildForm();
  return wrap;

  function buildForm() {
    let tipoRegistro = 'atividade';
    let contratoId = '';
    let setorNome = '';
    let submitting = false;

    const dataInput = el('input', { class: 'input', type: 'date', value: todayISO(), required: true });
    const inicioInput = el('input', { class: 'input', type: 'time', value: nowHHMM(), required: true });
    const terminoInput = el('input', { class: 'input', type: 'time', required: true });
    const obsInput = el('textarea', { class: 'textarea', placeholder: 'Observações (opcional)' });

    const setorFieldWrap = el('div');
    const contratoFieldWrap = el('div');
    const contratoSelectWrap = el('div');
    const atividadeSelectWrap = el('div');
    const alertaWrap = el('div');
    const justificativaWrap = el('div');
    const justificativaInput = el('textarea', { class: 'textarea', placeholder: 'Explique o motivo do desperdício (tempo acima do padrão e/ou mão de obra extra)' });
    const efetivo = efetivoInputs({}, () => atualizarDesperdicio());

    function atividadeSelecionada() {
      const sel = atividadeSelectWrap.querySelector('select');
      const id = sel ? sel.value : '';
      return atividades.find((a) => a.id === id) || null;
    }

    /** Contratos só existem entre as atividades produtivas — improdutividade não é filtrada por contrato. */
    function contratosDisponiveis() {
      return [...new Set(atividades.filter((a) => a.ativo !== false && a.tipo === 'produtiva' && a.contrato).map((a) => a.contrato))].sort();
    }

    function usaContrato() {
      return tipoRegistro === 'atividade' && contratosDisponiveis().length > 0;
    }

    function activeAtividades() {
      if (tipoRegistro === 'improdutividade') {
        return atividades.filter((a) => a.ativo !== false && a.tipo === 'improdutiva');
      }
      const produtivas = atividades.filter((a) => a.ativo !== false && a.tipo === 'produtiva');
      if (!usaContrato()) return produtivas;
      if (!contratoId) return [];
      return produtivas.filter((a) => a.contrato === contratoId);
    }

    function buildSetorSelect() {
      const ativos = setores.filter((s) => s.ativo !== false);
      if (ativos.length === 0) {
        mount(setorFieldWrap, []);
        return;
      }
      const sel = el('select', { class: 'select', onchange: (e) => { setorNome = e.target.value; } }, [
        el('option', { value: '' }, 'Selecione o setor…'),
        ...ativos.map((s) => el('option', { value: s.nome, selected: s.nome === setorNome }, s.nome))
      ]);
      mount(setorFieldWrap, [field({ label: 'Setor', input: sel })]);
    }

    function buildContratoSelect() {
      if (!usaContrato()) {
        mount(contratoFieldWrap, []);
        return;
      }
      const contratos = contratosDisponiveis();
      mount(contratoSelectWrap, [
        el(
          'select',
          {
            class: 'select',
            required: true,
            onchange: (e) => {
              contratoId = e.target.value;
              buildAtividadeSelect();
            }
          },
          [
            el('option', { value: '' }, 'Selecione o contrato…'),
            ...contratos.map((c) => el('option', { value: c, selected: c === contratoId }, c))
          ]
        )
      ]);
      mount(contratoFieldWrap, [field({ label: 'Contrato', input: contratoSelectWrap })]);
    }

    function buildAtividadeSelect() {
      const opts = activeAtividades();
      const semContratoEscolhido = usaContrato() && !contratoId;
      mount(atividadeSelectWrap, [
        el(
          'select',
          { class: 'select', required: true, disabled: semContratoEscolhido, onchange: () => onAtividadeChange() },
          [
            el(
              'option',
              { value: '' },
              semContratoEscolhido
                ? 'Selecione o contrato primeiro…'
                : opts.length
                  ? `Selecione a ${tipoRegistro === 'atividade' ? 'atividade' : 'improdutividade'}…`
                  : 'Nenhuma cadastrada — peça ao admin'
            ),
            ...opts.map((a) => el('option', { value: a.id }, a.codigo ? `${a.codigo} — ${a.nome}` : a.nome))
          ]
        )
      ]);
      onAtividadeChange();
    }

    /** Ao escolher uma atividade com padrão, pré-preenche término e efetivo. */
    function onAtividadeChange() {
      const a = atividadeSelecionada();
      if (a && a.tipo === 'produtiva') {
        if (Number(a.duracaoPadraoMin) > 0 && inicioInput.value) {
          terminoInput.value = somaHHMM(inicioInput.value, Number(a.duracaoPadraoMin));
        }
        if (efetivoTotal(a.efetivoPadrao) > 0) {
          efetivo.setValues(a.efetivoPadrao); // já dispara atualizarDesperdicio via onChange
          return;
        }
      }
      atualizarDesperdicio();
    }

    /** Reavalia em tempo real se há desperdício (tempo/efetivo) e mostra alerta + justificativa. */
    function atualizarDesperdicio() {
      const a = atividadeSelecionada();
      const dur = durationMinutes(inicioInput.value, terminoInput.value);
      const padraoMin = a && a.tipo === 'produtiva' ? Number(a.duracaoPadraoMin) || 0 : 0;
      const excedente = padraoMin > 0 ? Math.max(0, dur - padraoMin) : 0;
      const moExcede = a && a.tipo === 'produtiva' ? efetivoExcedido(efetivo.getValue(), a.efetivoPadrao) : false;

      const msgs = [];
      if (excedente > 0) msgs.push(`Tempo ${formatMinutes(excedente)} acima do padrão (${formatMinutes(padraoMin)}). O excedente entra como Desperdício Necessário.`);
      if (moExcede) msgs.push('Mão de obra acima do padrão configurado.');

      if (msgs.length) {
        mount(alertaWrap, [
          el('div', { class: 'inline-alert warn' }, [
            el('span', { html: icon.alert(15), style: { display: 'inline-flex', flexShrink: '0' } }),
            el('div', {}, msgs.map((m) => el('div', {}, m)))
          ])
        ]);
        mount(justificativaWrap, [field({ label: 'Justificativa do desperdício', input: justificativaInput, hint: 'Obrigatória quando há excesso de tempo ou de mão de obra.' })]);
      } else {
        mount(alertaWrap, []);
        mount(justificativaWrap, []);
      }
    }

    buildSetorSelect();
    buildContratoSelect();
    buildAtividadeSelect();

    const atividadeLabel = document.createTextNode('Atividade em execução');

    const tipoTabs = segmented(
      [
        { value: 'atividade', label: 'Atividade' },
        { value: 'improdutividade', label: 'Improdutividade' }
      ],
      tipoRegistro,
      (val) => {
        tipoRegistro = val;
        contratoId = '';
        atividadeLabel.textContent = val === 'atividade' ? 'Atividade em execução' : 'Improdutividade em execução';
        Array.from(tipoTabs.children).forEach((btn, i) => btn.classList.toggle('active', i === (val === 'atividade' ? 0 : 1)));
        buildContratoSelect();
        buildAtividadeSelect();
      }
    );

    // recalcula o alerta quando o líder mexe nos horários manualmente
    inicioInput.addEventListener('change', atualizarDesperdicio);
    terminoInput.addEventListener('change', atualizarDesperdicio);

    const submitBtn = button({ label: 'Registrar lançamento', variant: 'primary', size: 'lg', block: true, type: 'submit', icon: icon.check(18) });

    const form = el(
      'form',
      {
        style: { display: 'flex', flexDirection: 'column', gap: '14px' },
        onsubmit: async (e) => {
          e.preventDefault();
          if (submitting) return;

          const atividade = atividadeSelecionada();
          const atividadeId = atividade?.id || '';

          if (!dataInput.value || !inicioInput.value || !terminoInput.value) {
            toast('Preencha data, horário de início e término.', 'error');
            return;
          }
          if (usaContrato() && !contratoId) {
            toast('Selecione o contrato.', 'error');
            return;
          }
          if (!atividadeId) {
            toast(`Selecione a ${tipoRegistro === 'atividade' ? 'atividade' : 'improdutividade'}.`, 'error');
            return;
          }

          const dur = durationMinutes(inicioInput.value, terminoInput.value);
          const padraoMin = atividade.tipo === 'produtiva' ? Number(atividade.duracaoPadraoMin) || 0 : 0;
          const excedente = padraoMin > 0 ? Math.max(0, dur - padraoMin) : 0;
          const moExcede = atividade.tipo === 'produtiva' ? efetivoExcedido(efetivo.getValue(), atividade.efetivoPadrao) : false;
          if ((excedente > 0 || moExcede) && !justificativaInput.value.trim()) {
            toast('Justifique o desperdício antes de registrar.', 'error');
            justificativaInput.focus();
            return;
          }

          submitting = true;
          submitBtn.disabled = true;

          try {
            await createLancamento({
              data: dataInput.value,
              horaInicio: inicioInput.value,
              horaTermino: terminoInput.value,
              tipoRegistro,
              contrato: usaContrato() ? contratoId : '',
              setor: setorNome,
              atividadeId,
              atividadeNome: atividade?.nome || '',
              atividadeTipo: atividade?.tipo || '',
              classificacao: atividade?.classificacao || '',
              duracaoPadraoMin: padraoMin,
              efetivoPadrao: atividade?.efetivoPadrao || {},
              efetivo: efetivo.getValue(),
              justificativa: justificativaInput.value,
              observacoes: obsInput.value,
              criadoPorUid: profile.uid,
              criadoPorNome: profile.nomeCompleto
            });
            if (excedente > 0 || moExcede) {
              toast('Registrado com desperdício sinalizado. Ele sincroniza automaticamente.', 'warn', 4500);
            } else {
              toast('Lançamento registrado! Ele sincroniza automaticamente.', 'ok');
            }
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
        sectionTitle('Quando', true),
        field({ label: 'Data', input: dataInput }),
        el('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', gap: '14px' } }, [
          field({ label: 'Início', input: inicioInput }),
          field({ label: 'Término', input: terminoInput })
        ]),

        sectionTitle('Etapa'),
        setorFieldWrap,
        el('div', { class: 'field' }, [el('label', { class: 'field-label' }, 'O que está sendo registrado?'), tipoTabs]),
        contratoFieldWrap,
        field({ label: atividadeLabel, input: atividadeSelectWrap }),

        sectionTitle('Efetivo utilizado'),
        efetivo.node,
        el('div', { class: 'field-hint' }, 'Vem pré-preenchido pelo padrão da atividade — ajuste se precisar.'),

        alertaWrap,
        justificativaWrap,

        sectionTitle('Observações'),
        obsInput,

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
