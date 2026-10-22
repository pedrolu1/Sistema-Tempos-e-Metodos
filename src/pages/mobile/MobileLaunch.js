import { el, mount } from '../../utils/dom.js';
import { field, button, segmented, card, celebrar, modal, switchToggle } from '../../components/ui.js';
import { efetivoInputs } from '../../components/EfetivoInputs.js';
import { icon } from '../../utils/icons.js';
import { todayISO, nowHHMM, durationMinutes, formatMinutes, efetivoExcedido, efetivoTotal, escalaLabel } from '../../utils/format.js';
import { efetivoDiferencas, formatDiferencas } from '../../utils/planejamento.js';
import { opcoesAtividade } from '../../utils/opcoesAtividade.js';
import { projetosAtivos } from '../../lib/projetos.js';
import { analisarApontador } from '../../lib/agentes.js';
import { createLancamento } from '../../lib/records.js';
import { listarAbertos, guardarAberto, removerAberto, minutosDecorridos } from '../../lib/abertos.js';
import { toast } from '../../lib/toast.js';

/** Soma minutos a um horário HH:MM, com virada de dia. */
function somaHHMM(hhmm, min) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const t = (((h * 60 + m + min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

const lembrar = {
  ler: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  gravar: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento: só não lembra */ } }
};
const PROJETO_KEY = 'rfx.projeto';
const DICAS_KEY = 'rfx.dicas.dispensadas';

/** Excesso de um lançamento em relação ao planejado da atividade escolhida. */
function avaliarExcesso(op, dur, equipe) {
  if (!op || op.tipo !== 'produtiva') return { tempo: 0, equipe: false, difs: [] };
  const padrao = Number(op.duracaoPadraoMin) || 0;
  return {
    tempo: padrao > 0 ? Math.max(0, dur - padrao) : 0,
    equipe: efetivoExcedido(equipe, op.efetivoPadrao),
    difs: efetivoDiferencas(equipe, op.efetivoPadrao),
    padrao
  };
}

/** Caixa de aviso de desperdício/divergência (a mesma no formulário e no "Finalizar"). */
function avisoExcesso(ex) {
  const msgs = [];
  if (ex.tempo > 0) msgs.push(`Tempo ${formatMinutes(ex.tempo)} acima do planejado (${formatMinutes(ex.padrao)}). O excedente conta como Desperdício Necessário.`);
  if (ex.equipe) msgs.push('Equipe acima do planejado.');
  if (msgs.length) {
    if (ex.difs.length) msgs.push(formatDiferencas(ex.difs));
    return el('div', { class: 'inline-alert warn' }, [el('span', { html: icon.alert(15), style: { display: 'inline-flex', flexShrink: '0' } }), el('div', {}, msgs.map((m) => el('div', {}, m)))]);
  }
  if (ex.difs.length) {
    return el('div', { class: 'inline-alert info' }, [
      el('span', { html: icon.lightbulb(15), style: { display: 'inline-flex', flexShrink: '0' } }),
      el('div', {}, [el('div', {}, 'Diferente do planejado — o planejador será avisado.'), el('div', {}, formatDiferencas(ex.difs))])
    ]);
  }
  return null;
}

/** Dados do lançamento a partir do que foi escolhido (formulário ou lançamento em aberto). */
function montarLancamento({ data, horaInicio, horaTermino, tipoRegistro, projeto, setor, contrato, op, efetivo, justificativa, observacoes, profile }) {
  return {
    data,
    horaInicio,
    horaTermino,
    tipoRegistro,
    contrato: projeto ? projeto.contratoNome : contrato || '',
    setor: projeto?.setor || setor || '',
    projetoId: projeto?.id || '',
    projetoNome: projeto?.nome || '',
    clienteNome: projeto?.clienteNome || '',
    etapaId: op.etapaId || '',
    atividadeId: op.atividadeId,
    atividadeNome: op.nome,
    atividadeTipo: op.tipo,
    classificacao: op.classificacao,
    duracaoPadraoMin: op.tipo === 'produtiva' ? op.duracaoPadraoMin : 0,
    efetivoPadrao: op.efetivoPadrao || {},
    efetivo,
    justificativa,
    observacoes,
    criadoPorUid: profile.uid,
    criadoPorNome: profile.nomeCompleto
  };
}

export function renderLaunchPage({ atividades, setores = [], projetos = [], lancamentos = [], profile }) {
  const tips = el('div', { class: 'field-tips' });
  const abertosWrap = el('div');
  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } });
  const node = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [tips, abertosWrap, wrap]);
  let relogio = null;

  atualizarDicas(lancamentos);
  pintarAbertos();
  buildForm();
  return { node, atualizarDicas };

  /** Até 2 dicas do assistente de campo; cada uma pode ser fechada. */
  function atualizarDicas(lista) {
    lancamentos = lista;
    let fora;
    try { fora = new Set(JSON.parse(lembrar.ler(DICAS_KEY) || '[]')); } catch { fora = new Set(); }
    const dicas = analisarApontador({ lancamentos, projetos }).filter((d) => !fora.has(d.id)).slice(0, 2);
    mount(tips, dicas.map((d) =>
      el('div', { class: `field-tip ${d.nivel}` }, [
        el('span', { class: 'tip-icon', html: d.nivel === 'atencao' ? icon.alert(16) : d.nivel === 'ok' ? icon.bolt(16) : icon.lightbulb(16) }),
        el('div', {}, [el('strong', {}, d.titulo), el('p', {}, d.texto)]),
        el('button', { class: 'tip-close', type: 'button', 'aria-label': 'Fechar dica', html: icon.x(14), onclick: () => {
          fora.add(d.id);
          lembrar.gravar(DICAS_KEY, JSON.stringify([...fora].slice(-200)));
          atualizarDicas(lancamentos);
        } })
      ])
    ));
  }

  // ------------------------------------------------------------------
  // Em andamento (lançamentos sem término)
  // ------------------------------------------------------------------
  /** Volta ao topo: o "Em andamento" e o formulário limpo ficam à vista. */
  function topo() {
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  function pintarAbertos() {
    clearInterval(relogio);
    const abertos = listarAbertos(profile.uid);
    if (!abertos.length) return mount(abertosWrap, []);
    const tempos = [];
    mount(abertosWrap, [
      el('div', { class: 'abertos' }, [
        el('div', { class: 'section-title' }, `Em andamento (${abertos.length})`),
        ...abertos.map((a) => {
          const tempo = el('span', { class: 'mono' });
          tempos.push([tempo, a]);
          return el('div', { class: 'aberto-card' }, [
            el('div', { class: 'aberto-info' }, [
              el('strong', {}, a.op.nome),
              el('small', {}, [a.projetoNome || 'Avulso', ` · desde ${a.horaInicio}`, a.data !== todayISO() ? ` de ${a.data.slice(8, 10)}/${a.data.slice(5, 7)}` : '']),
              el('div', { class: 'aberto-tempo' }, [el('span', { html: icon.clock(14) }), tempo])
            ]),
            el('div', { class: 'aberto-acoes' }, [
              button({ label: 'Finalizar', variant: 'primary', icon: icon.check(16), onClick: () => finalizar(a) }),
              button({ iconOnly: true, variant: 'ghost', size: 'sm', icon: icon.trash(15), onClick: () => descartar(a) })
            ])
          ]);
        })
      ])
    ]);
    const tick = () => {
      if (!node.isConnected && relogio) return clearInterval(relogio); // a aba foi trocada
      tempos.forEach(([span, a]) => { span.textContent = `${formatMinutes(minutosDecorridos(a))} em andamento`; });
    };
    tick();
    relogio = setInterval(tick, 30000);
  }

  function descartar(a) {
    const close = () => backdrop.remove();
    const backdrop = modal({
      title: 'Descartar este lançamento?',
      body: [el('p', { style: { fontSize: '13.5px', color: 'var(--text-1)' } }, `"${a.op.nome}" iniciado às ${a.horaInicio} não será registrado.`)],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({ label: 'Descartar', variant: 'danger', onClick: () => { removerAberto(profile.uid, a.id); close(); pintarAbertos(); } })
      ],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  /** Aponta o término (padrão: agora) e grava como lançamento normal. */
  function finalizar(a) {
    const terminoInput = el('input', { class: 'input', type: 'time', value: nowHHMM() });
    const aviso = el('div');
    const justificativaWrap = el('div');
    const justificativa = el('textarea', { class: 'textarea', placeholder: 'Conte o que atrasou (material, liberação, equipe…)' });
    const obs = el('textarea', { class: 'textarea', value: a.observacoes || '', placeholder: 'Observações (opcional)' });
    const efetivo = efetivoInputs(a.efetivo || {}, () => avaliar());
    if (a.op.tipo === 'produtiva' && efetivoTotal(a.op.efetivoPadrao) > 0) efetivo.setPlanejado(a.op.efetivoPadrao);
    const excesso = () => avaliarExcesso(a.op, durationMinutes(a.horaInicio, terminoInput.value), efetivo.getValue());
    const avaliar = () => {
      const ex = excesso();
      mount(aviso, [avisoExcesso(ex)]);
      mount(justificativaWrap, ex.tempo > 0 || ex.equipe ? [field({ label: 'Justificativa', input: justificativa, hint: 'Obrigatória quando passa do planejado.' })] : []);
    };
    terminoInput.addEventListener('change', avaliar);
    avaliar();

    const close = () => backdrop.remove();
    const salvar = button({ label: 'Registrar', variant: 'primary', icon: icon.check(16), onClick: async () => {
      if (!terminoInput.value) return toast('Informe o horário de término.', 'error');
      if (terminoInput.value === a.horaInicio) return toast('O término está igual ao início — confira o horário.', 'error');
      const ex = excesso();
      if ((ex.tempo > 0 || ex.equipe) && !justificativa.value.trim()) {
        justificativa.focus();
        return toast('Passou do planejado: escreva a justificativa.', 'error');
      }
      salvar.disabled = true;
      try {
        const projeto = projetos.find((p) => p.id === a.projetoId) || null;
        await createLancamento(montarLancamento({
          data: a.data, horaInicio: a.horaInicio, horaTermino: terminoInput.value, tipoRegistro: a.tipoRegistro, projeto, setor: a.setor, contrato: a.contrato,
          op: a.op, efetivo: efetivo.getValue(), justificativa: justificativa.value, observacoes: obs.value, profile
        }));
        removerAberto(profile.uid, a.id);
        close();
        pintarAbertos();
        celebrar('Lançamento registrado!', `${a.op.nome} · ${a.horaInicio}–${terminoInput.value}`);
      } catch {
        salvar.disabled = false;
        toast('Não foi possível registrar. Tente novamente.', 'error');
      }
    } });
    const backdrop = modal({
      title: `Finalizar — ${a.op.nome}`,
      body: [
        el('div', { class: 'muted', style: { fontSize: '13px' } }, `Começou às ${a.horaInicio}${a.projetoNome ? ` · ${a.projetoNome}` : ''}`),
        field({ label: 'Término', input: terminoInput, hint: 'Já vem com o horário de agora — ajuste se terminou antes.' }),
        a.tipoRegistro === 'atividade' ? field({ label: 'Equipe utilizada', input: efetivo.node }) : null,
        aviso,
        justificativaWrap,
        field({ label: 'Observações', input: obs })
      ],
      footer: [button({ label: 'Cancelar', variant: 'ghost', onClick: close }), salvar],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  // ------------------------------------------------------------------
  // Novo lançamento
  // ------------------------------------------------------------------
  function buildForm() {
    let tipoRegistro = 'atividade';
    let contratoId = '';
    let setorNome = '';
    let terminarDepois = false;
    let enviando = false;
    let opcoes = [];
    const projetosAbertos = projetosAtivos(projetos);
    // lembra o último projeto usado neste aparelho; se só existe um, já vem escolhido
    const salvo = lembrar.ler(PROJETO_KEY);
    let projetoId = projetosAbertos.some((p) => p.id === salvo) ? salvo : projetosAbertos.length === 1 ? projetosAbertos[0].id : '';
    const projeto = () => projetosAbertos.find((p) => p.id === projetoId) || null;

    const dataInput = el('input', { class: 'input', type: 'date', value: todayISO() });
    const inicioInput = el('input', { class: 'input', type: 'time', value: nowHHMM() });
    const terminoInput = el('input', { class: 'input', type: 'time' });
    const obsInput = el('textarea', { class: 'textarea', placeholder: 'Observações (opcional)' });
    const justificativaInput = el('textarea', { class: 'textarea', placeholder: 'Explique o motivo (tempo acima do planejado e/ou equipe extra)' });

    const projetoWrap = el('div');
    const planoWrap = el('div');
    const setorWrap = el('div');
    const contratoWrap = el('div');
    const atividadeWrap = el('div');
    const terminoWrap = el('div');
    const alertaWrap = el('div');
    const justificativaWrap = el('div');
    const efetivo = efetivoInputs({}, () => atualizarAviso());
    const enviar = el('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' });

    const selecionada = () => opcoes.find((o) => o.value === atividadeWrap.querySelector('select')?.value) || null;
    const contratosAvulsos = () => [...new Set(atividades.filter((a) => a.ativo !== false && a.tipo === 'produtiva' && a.contrato).map((a) => a.contrato))].sort();
    const pedeContrato = () => tipoRegistro === 'atividade' && !projeto() && contratosAvulsos().length > 0;

    function montarProjeto() {
      if (!projetosAbertos.length) return mount(projetoWrap, []);
      mount(projetoWrap, [field({ label: 'Projeto', input: el('select', { class: 'select', onchange: (e) => {
        projetoId = e.target.value;
        lembrar.gravar(PROJETO_KEY, projetoId);
        contratoId = '';
        montarTudo();
      } }, [
        el('option', { value: '' }, 'Sem projeto (lançamento avulso)'),
        ...projetosAbertos.map((p) => el('option', { value: p.id, selected: p.id === projetoId }, `${p.nome} — ${p.contratoNome}`))
      ]) })]);
      const p = projeto();
      if (!p) return mount(planoWrap, []);
      const f = p.ficha || {};
      mount(planoWrap, [el('div', { class: 'plan-card' }, [
        el('strong', {}, 'Planejado para este projeto'),
        el('div', {}, `${escalaLabel(f.escala)} · ${f.horaChegada || '—'} às ${f.horaSaida || '—'}${f.almocoInicio ? ` · almoço ${f.almocoInicio}–${f.almocoFim}` : ''}`),
        el('div', {}, `${(p.etapas || []).length} atividade(s) · ${p.clienteNome} › ${p.contratoNome}`),
        f.restricoes?.length ? el('div', { class: 'chip-row' }, f.restricoes.map((r) => el('span', { class: 'chip chip-warn' }, [el('span', { html: icon.alert(11) }), r]))) : null
      ])]);
    }

    function montarSetor() {
      const ativos = setores.filter((s) => s.ativo !== false);
      if (!ativos.length || projeto()?.setor) return mount(setorWrap, []); // o projeto já define o setor
      mount(setorWrap, [field({ label: 'Setor', input: el('select', { class: 'select', onchange: (e) => { setorNome = e.target.value; } }, [
        el('option', { value: '' }, 'Selecione o setor…'),
        ...ativos.map((s) => el('option', { value: s.nome, selected: s.nome === setorNome }, s.nome))
      ]) })]);
    }

    function montarContrato() {
      if (!pedeContrato()) return mount(contratoWrap, []);
      mount(contratoWrap, [field({ label: 'Contrato', input: el('select', { class: 'select', onchange: (e) => { contratoId = e.target.value; montarAtividade(); } }, [
        el('option', { value: '' }, 'Selecione o contrato…'),
        ...contratosAvulsos().map((c) => el('option', { value: c, selected: c === contratoId }, c))
      ]) })]);
    }

    function montarAtividade() {
      const faltaContrato = pedeContrato() && !contratoId;
      opcoes = faltaContrato ? [] : opcoesAtividade({ tipoRegistro, projeto: projeto(), atividades, contrato: pedeContrato() ? contratoId : '' });
      const nome = tipoRegistro === 'atividade' ? 'atividade' : 'improdutividade';
      mount(atividadeWrap, [el('select', { class: 'select', disabled: faltaContrato, onchange: aoEscolher }, [
        el('option', { value: '' }, faltaContrato ? 'Escolha o contrato primeiro…' : opcoes.length ? `Selecione a ${nome}…` : `Nenhuma ${nome} cadastrada — avise o planejador`),
        ...opcoes.map((o) => el('option', { value: o.value }, o.label))
      ])]);
      aoEscolher();
    }

    /** Ao escolher a atividade: término e equipe vêm do planejado. */
    function aoEscolher() {
      const op = selecionada();
      const produtiva = op && op.tipo === 'produtiva';
      efetivo.setPlanejado(produtiva && efetivoTotal(op.efetivoPadrao) > 0 ? op.efetivoPadrao : null);
      if (produtiva && op.duracaoPadraoMin > 0 && inicioInput.value) terminoInput.value = somaHHMM(inicioInput.value, op.duracaoPadraoMin);
      if (produtiva && efetivoTotal(op.efetivoPadrao) > 0) efetivo.setValues(op.efetivoPadrao);
      else if (!projeto() && op && !produtiva) efetivo.setValues({});
      atualizarAviso();
    }

    function montarTermino() {
      const chave = switchToggle(terminarDepois, (v) => {
        terminarDepois = v;
        montarTermino();
        atualizarAviso();
      });
      mount(terminoWrap, [
        el('label', { class: 'termino-depois' }, [chave, el('span', {}, [el('strong', {}, 'Terminar depois'), el('small', {}, 'Começa agora e você finaliza quando acabar')])]),
        terminarDepois ? null : field({ label: 'Término', input: terminoInput })
      ]);
      enviar.innerHTML = '';
      enviar.append(el('span', { html: terminarDepois ? icon.clock(18) : icon.check(18), style: { display: 'inline-flex' } }), terminarDepois ? ' Iniciar agora' : ' Registrar lançamento');
    }

    function atualizarAviso() {
      const op = selecionada();
      const ex = avaliarExcesso(op, terminarDepois ? 0 : durationMinutes(inicioInput.value, terminoInput.value), efetivo.getValue());
      const aviso = avisoExcesso(terminarDepois ? { ...ex, tempo: 0 } : ex);
      mount(alertaWrap, [aviso]);
      const precisa = !terminarDepois && (ex.tempo > 0 || ex.equipe);
      mount(justificativaWrap, precisa ? [field({ label: 'Justificativa', input: justificativaInput, hint: 'Obrigatória quando passa do planejado — conte o que aconteceu.' })] : []);
    }

    function montarTudo() {
      montarProjeto();
      montarSetor();
      montarContrato();
      montarAtividade();
    }

    const tipoTabs = segmented([{ value: 'atividade', label: 'Atividade' }, { value: 'improdutividade', label: 'Improdutividade' }], tipoRegistro, (v) => {
      tipoRegistro = v;
      contratoId = '';
      Array.from(tipoTabs.children).forEach((b, i) => b.classList.toggle('active', i === (v === 'atividade' ? 0 : 1)));
      montarContrato();
      montarAtividade();
    });
    inicioInput.addEventListener('change', atualizarAviso);
    terminoInput.addEventListener('change', atualizarAviso);
    montarTudo();
    montarTermino();

    async function aoEnviar(e) {
      e.preventDefault();
      if (enviando) return;
      const op = selecionada();
      if (pedeContrato() && !contratoId) return toast('Selecione o contrato.', 'error');
      if (!op) return toast(`Selecione a ${tipoRegistro === 'atividade' ? 'atividade' : 'improdutividade'}.`, 'error');
      if (!dataInput.value || !inicioInput.value) return toast('Preencha a data e o horário de início.', 'error');
      const p = projeto();

      if (terminarDepois) {
        const ok = guardarAberto(profile.uid, {
          data: dataInput.value, horaInicio: inicioInput.value, tipoRegistro, projetoId: p?.id || '', projetoNome: p?.nome || '',
          setor: p?.setor || setorNome, contrato: p ? p.contratoNome : contratoId, op, efetivo: efetivo.getValue(), observacoes: obsInput.value
        });
        if (!ok) return toast('Este celular não deixou guardar. Registre com o horário de término.', 'error');
        toast(`"${op.nome}" em andamento. Toque em Finalizar quando terminar.`, 'ok', 4000);
        mount(wrap, []);
        pintarAbertos();
        buildForm();
        topo();
        return;
      }

      if (!terminoInput.value) return toast('Informe o término — ou ligue "Terminar depois".', 'error');
      if (terminoInput.value === inicioInput.value) return toast('O término está igual ao início — confira o horário.', 'error');
      const ex = avaliarExcesso(op, durationMinutes(inicioInput.value, terminoInput.value), efetivo.getValue());
      if ((ex.tempo > 0 || ex.equipe) && !justificativaInput.value.trim()) {
        justificativaInput.focus();
        return toast('Justifique antes de registrar.', 'error');
      }
      enviando = true;
      enviar.disabled = true;
      try {
        await createLancamento(montarLancamento({
          data: dataInput.value, horaInicio: inicioInput.value, horaTermino: terminoInput.value, tipoRegistro, projeto: p, setor: setorNome, contrato: contratoId,
          op, efetivo: efetivo.getValue(), justificativa: justificativaInput.value, observacoes: obsInput.value, profile
        }));
        if (ex.tempo > 0 || ex.equipe) toast('Registrado com desperdício sinalizado. Ele sobe sozinho para o sistema.', 'warn', 4500);
        else celebrar('Lançamento registrado!', 'Ele sobe sozinho para o sistema — mesmo se estiver sem internet agora.');
        mount(wrap, []);
        buildForm();
        topo();
      } catch {
        toast('Não foi possível registrar. Tente novamente.', 'error');
        enviando = false;
        enviar.disabled = false;
      }
    }

    const titulo = (t) => el('div', { class: 'section-title' }, t);
    mount(wrap, [card([
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' } }, [
        el('span', { html: icon.bolt(18), style: { color: 'var(--accent-400)', display: 'inline-flex' } }),
        el('strong', { style: { fontFamily: 'var(--font-display)', fontSize: '14px' } }, 'Novo lançamento')
      ]),
      el('form', { class: 'launch-form', onsubmit: aoEnviar }, [
        titulo('O que está sendo feito'),
        projetoWrap,
        planoWrap,
        setorWrap,
        field({ label: 'Tipo', input: tipoTabs }),
        contratoWrap,
        field({ label: 'Qual', input: atividadeWrap }),
        titulo('Quando'),
        el('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', gap: '14px' } }, [field({ label: 'Data', input: dataInput }), field({ label: 'Início', input: inicioInput })]),
        terminoWrap,
        titulo('Equipe'),
        efetivo.node,
        el('div', { class: 'field-hint' }, 'Vem preenchida com o planejado — se em campo for diferente, ajuste com − e +.'),
        alertaWrap,
        justificativaWrap,
        titulo('Observações'),
        obsInput,
        enviar
      ])
    ])]);
  }
}
