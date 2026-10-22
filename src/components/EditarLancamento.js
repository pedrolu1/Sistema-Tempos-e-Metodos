import { el, mount } from '../utils/dom.js';
import { field, button, modal, segmented } from './ui.js';
import { efetivoInputs } from './EfetivoInputs.js';
import { icon } from '../utils/icons.js';
import { durationMinutes, formatMinutes, efetivoExcedido } from '../utils/format.js';
import { opcoesAtividade, opcaoDoLancamento } from '../utils/opcoesAtividade.js';
import { updateLancamento, deleteLancamento } from '../lib/records.js';
import { toast } from '../lib/toast.js';

/**
 * Edição completa de um lançamento (painel e app de campo): data, horários,
 * tipo, atividade (do projeto ou do catálogo), equipe, justificativa e
 * observações. Se a atividade não mudar, o planejado gravado no lançamento é
 * mantido; se mudar, passa a valer o planejado da nova atividade.
 */
export function abrirEdicaoLancamento(l, { projetos = [], atividades = [] }) {
  const projeto = projetos.find((p) => p.id === l.projetoId) || null;
  let tipoRegistro = l.tipoRegistro === 'improdutividade' ? 'improdutividade' : 'atividade';

  const dataInput = el('input', { class: 'input', type: 'date', value: l.data });
  const inicioInput = el('input', { class: 'input', type: 'time', value: l.horaInicio });
  const terminoInput = el('input', { class: 'input', type: 'time', value: l.horaTermino });
  const justificativa = el('textarea', { class: 'textarea', value: l.justificativa || '', placeholder: 'Obrigatória quando passa do planejado' });
  const obs = el('textarea', { class: 'textarea', value: l.observacoes || '', placeholder: 'Opcional' });
  const atividadeWrap = el('div');
  const aviso = el('div');
  const efetivo = efetivoInputs(l.efetivo || {}, () => avaliar());
  let opcoes = [];

  const selecionada = () => opcoes.find((o) => o.value === atividadeWrap.querySelector('select')?.value) || null;

  /** Padrões que valem para a opção escolhida (os gravados, se a atividade não mudou). */
  function padroes(op) {
    if (!op) return { duracaoPadraoMin: 0, efetivoPadrao: {} };
    const original = opcaoDoLancamento(opcoes, l);
    if (original && original.value === op.value && l.tipoRegistro === tipoRegistro) return { duracaoPadraoMin: Number(l.duracaoPadraoMin) || 0, efetivoPadrao: l.efetivoPadrao || {} };
    return { duracaoPadraoMin: op.duracaoPadraoMin, efetivoPadrao: op.efetivoPadrao };
  }

  function montarSelect() {
    opcoes = opcoesAtividade({ tipoRegistro, projeto, atividades, contrato: projeto ? '' : l.contrato });
    const atual = opcaoDoLancamento(opcoes, l);
    mount(atividadeWrap, [
      el('select', { class: 'select', onchange: avaliar }, [
        el('option', { value: '' }, 'Selecione…'),
        ...opcoes.map((o) => el('option', { value: o.value, selected: atual && o.value === atual.value && l.tipoRegistro === tipoRegistro }, o.label))
      ])
    ]);
    const op = selecionada();
    efetivo.setPlanejado(op && tipoRegistro === 'atividade' ? padroes(op).efetivoPadrao : null);
    avaliar();
  }

  /** Mostra se o lançamento editado passou do planejado (tempo ou equipe). */
  function excesso() {
    const op = selecionada();
    if (!op || tipoRegistro !== 'atividade') return { tempo: 0, equipe: false };
    const { duracaoPadraoMin, efetivoPadrao } = padroes(op);
    const dur = durationMinutes(inicioInput.value, terminoInput.value);
    return { tempo: duracaoPadraoMin > 0 ? Math.max(0, dur - duracaoPadraoMin) : 0, equipe: efetivoExcedido(efetivo.getValue(), efetivoPadrao) };
  }

  function avaliar() {
    const op = selecionada();
    if (op && tipoRegistro === 'atividade') efetivo.setPlanejado(padroes(op).efetivoPadrao);
    const { tempo, equipe } = excesso();
    const msgs = [tempo > 0 && `Tempo ${formatMinutes(tempo)} acima do planejado.`, equipe && 'Equipe acima do planejado.'].filter(Boolean);
    mount(aviso, msgs.length ? [el('div', { class: 'inline-alert warn' }, [el('span', { html: icon.alert(15), style: { display: 'inline-flex' } }), el('div', {}, msgs.join(' '))])] : []);
  }
  inicioInput.addEventListener('change', avaliar);
  terminoInput.addEventListener('change', avaliar);

  const tabs = segmented([{ value: 'atividade', label: 'Atividade' }, { value: 'improdutividade', label: 'Improdutividade' }], tipoRegistro, (v) => {
    tipoRegistro = v;
    Array.from(tabs.children).forEach((b, i) => b.classList.toggle('active', i === (v === 'atividade' ? 0 : 1)));
    montarSelect();
  });
  montarSelect();

  const close = () => backdrop.remove();
  const salvar = button({ label: 'Salvar alterações', variant: 'primary', onClick: async () => {
    const op = selecionada();
    if (!dataInput.value || !inicioInput.value || !terminoInput.value) return toast('Preencha data, início e término.', 'error');
    if (inicioInput.value === terminoInput.value) return toast('O término está igual ao início — confira o horário.', 'error');
    if (!op) return toast('Escolha a atividade.', 'error');
    const { tempo, equipe } = excesso();
    if ((tempo > 0 || equipe) && !justificativa.value.trim()) {
      justificativa.focus();
      return toast('Passou do planejado: escreva a justificativa.', 'error');
    }
    salvar.disabled = true;
    try {
      await updateLancamento(l.id, {
        data: dataInput.value,
        horaInicio: inicioInput.value,
        horaTermino: terminoInput.value,
        tipoRegistro,
        contrato: l.contrato || '',
        setor: l.setor || '',
        projetoId: l.projetoId || '',
        projetoNome: l.projetoNome || '',
        clienteNome: l.clienteNome || '',
        etapaId: op.etapaId,
        atividadeId: op.atividadeId,
        atividadeNome: op.nome,
        atividadeTipo: op.tipo,
        classificacao: op.classificacao,
        ...padroes(op),
        efetivo: efetivo.getValue(),
        justificativa: justificativa.value,
        observacoes: obs.value,
        liderId: l.liderId || '',
        liderNome: l.liderNome || '',
        colaboradoresIds: l.colaboradoresIds || [],
        colaboradoresNomes: l.colaboradoresNomes || []
      });
      toast('Lançamento atualizado.', 'ok');
      close();
    } catch {
      salvar.disabled = false;
      toast('Não foi possível salvar. Tente novamente.', 'error');
    }
  } });

  const backdrop = modal({
    title: 'Editar lançamento',
    body: [
      projeto || l.projetoNome ? el('div', { class: 'muted', style: { fontSize: '12.5px' } }, `Projeto: ${l.projetoNome || projeto?.nome}`) : null,
      field({ label: 'Data', input: dataInput }),
      el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }, [field({ label: 'Início', input: inicioInput }), field({ label: 'Término', input: terminoInput })]),
      field({ label: 'Tipo', input: tabs }),
      field({ label: 'Atividade', input: atividadeWrap }),
      field({ label: 'Equipe utilizada', input: efetivo.node }),
      aviso,
      field({ label: 'Justificativa', input: justificativa }),
      field({ label: 'Observações', input: obs })
    ],
    footer: [button({ label: 'Cancelar', variant: 'ghost', onClick: close }), salvar],
    onClose: close
  });
  document.body.appendChild(backdrop);
}

/** Confirma e exclui um lançamento (registrado na auditoria). */
export function confirmarExclusaoLancamento(l) {
  const close = () => backdrop.remove();
  const backdrop = modal({
    title: 'Excluir lançamento?',
    body: [el('p', { style: { fontSize: '13.5px', color: 'var(--text-1)', lineHeight: '1.5' } }, `"${l.atividadeNome || 'Lançamento'}" de ${l.horaInicio} a ${l.horaTermino}. Esta ação não pode ser desfeita.`)],
    footer: [
      button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
      button({ label: 'Excluir', variant: 'danger', icon: icon.trash(14), onClick: async () => {
        close();
        try {
          await deleteLancamento(l.id, `${l.atividadeNome || ''} · ${l.data} ${l.horaInicio}–${l.horaTermino} · ${l.criadoPorNome || ''}`);
          toast('Lançamento excluído.', 'ok');
        } catch {
          toast('Não foi possível excluir.', 'error');
        }
      } })
    ],
    onClose: close
  });
  document.body.appendChild(backdrop);
}
