import { el, mount } from '../../utils/dom.js';
import { badge, button, emptyState, field, modal, cardWithHeader } from '../../components/ui.js';
import { statTile, meter } from '../../components/charts.js';
import { efetivoInputs } from '../../components/EfetivoInputs.js';
import { icon } from '../../utils/icons.js';
import {
  ESCALAS,
  escalaInfo,
  escalaLabel,
  formatMinutes,
  formatDateBR,
  formatEfetivo,
  efetivoTotal,
  CLASSIFICACAO_INFO
} from '../../utils/format.js';
import { minutosUteisDia, resumoProjeto, formatDiferencas, efetivoDiferencas } from '../../utils/planejamento.js';
import {
  addCliente,
  updateCliente,
  deleteCliente,
  addContrato,
  updateContrato,
  deleteContrato,
  addProjeto,
  updateProjeto,
  deleteProjeto,
  fichaPadrao,
  STATUS_PROJETO
} from '../../lib/projetos.js';
import { toast } from '../../lib/toast.js';

const statusInfo = (v) => STATUS_PROJETO.find((s) => s.value === v) || STATUS_PROJETO[0];

/** Abre um modal simples e devolve a função que o fecha. */
function openModal({ title, body, onSave, saveLabel = 'Salvar', danger }) {
  const close = () => backdrop.remove();
  const backdrop = modal({
    title,
    body,
    footer: [
      button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
      button({
        label: saveLabel,
        variant: danger ? 'danger' : 'primary',
        onClick: async () => {
          try {
            const ok = await onSave();
            if (ok !== false) close();
          } catch {
            toast('Não foi possível salvar. Tente novamente.', 'error');
          }
        }
      })
    ],
    onClose: close
  });
  document.body.appendChild(backdrop);
}

function confirmar(title, message, onConfirm) {
  openModal({
    title,
    body: [el('p', { style: { fontSize: '13.5px', color: 'var(--text-1)' } }, message)],
    saveLabel: 'Remover',
    danger: true,
    onSave: onConfirm
  });
}

const input = (props) => el('input', { class: 'input', type: 'text', ...props });
const grid2 = (children) => el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }, children);

export function renderProjetosPage(ctx) {
  let { clientes, contratos, projetos, atividades, setores, lancamentos } = ctx;
  const profile = ctx.profile;
  let abertoId = null; // projeto aberto no detalhe (null = lista)
  let filtroContrato = 'todos';

  const node = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } });

  function paint() {
    const aberto = abertoId && projetos.find((p) => p.id === abertoId);
    if (aberto) mount(node, renderDetalhe(aberto));
    else {
      abertoId = null;
      mount(node, renderLista());
    }
  }

  // =====================================================================
  // LISTA
  // =====================================================================
  function renderLista() {
    return [guiaInicio(), cardClientes(), cardProjetos(), cardPlanilha()].filter(Boolean);
  }

  /** Passo a passo visível enquanto a estrutura não está completa. */
  function guiaInicio() {
    const passos = [
      { feito: clientes.length > 0, titulo: 'Cadastre o cliente', texto: 'Ex.: Ternium — Santa Cruz' },
      { feito: contratos.length > 0, titulo: 'Cadastre o contrato', texto: 'Ex.: Coqueria, Alto-Forno, Aciaria' },
      { feito: projetos.length > 0, titulo: 'Crie o projeto', texto: 'Ficha + etapas planejadas' }
    ];
    if (passos.every((p) => p.feito)) return null;
    return el('div', { class: 'guide-steps' }, passos.map((p, i) =>
      el('div', { class: `guide-step${p.feito ? ' done' : ''}` }, [
        el('span', { class: 'guide-step-num', html: p.feito ? icon.check(16) : String(i + 1) }),
        el('div', {}, [el('strong', {}, p.titulo), el('small', {}, p.texto)])
      ])
    ));
  }

  function cardClientes() {
    const body = clientes.length === 0
      ? emptyState({ icon: icon.building(34), title: 'Nenhum cliente ainda', message: 'Comece cadastrando o cliente atendido pela Reframax.' })
      : el('div', { class: 'tree-list' }, clientes.map((c) => {
          const seus = contratos.filter((ct) => ct.clienteId === c.id);
          return el('div', { class: 'tree-row' }, [
            el('div', { class: 'tree-head' }, [
              el('span', { html: icon.building(16), style: { color: 'var(--accent-400)', display: 'inline-flex' } }),
              el('strong', {}, c.nome),
              c.unidade ? el('span', { class: 'muted' }, c.unidade) : null,
              el('div', { class: 'toolbar', style: { marginLeft: 'auto' } }, [
                button({ label: 'Contrato', size: 'sm', variant: 'ghost', icon: icon.plus(14), onClick: () => modalContrato(null, c) }),
                button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.edit(14), onClick: () => modalCliente(c) }),
                button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.trash(14), onClick: () => removerCliente(c, seus) })
              ])
            ]),
            el('div', { class: 'chip-row' }, seus.length
              ? seus.map((ct) => el('button', { class: 'chip', type: 'button', title: 'Editar contrato', onclick: () => modalContrato(ct, c) }, [
                  ct.nome,
                  ct.numero ? el('span', { class: 'mono muted' }, ` nº ${ct.numero}`) : null
                ]))
              : el('span', { class: 'muted', style: { fontSize: '12.5px' } }, 'Nenhum contrato — clique em "+ Contrato".'))
          ]);
        }));
    return cardWithHeader({
      title: 'Clientes e contratos',
      subtitle: 'Quem contrata e em quais frentes a Reframax atua',
      actions: [button({ label: 'Novo cliente', size: 'sm', variant: 'outline', icon: icon.plus(15), onClick: () => modalCliente() })],
      children: [body]
    });
  }

  function cardProjetos() {
    const filtroSel = el('select', { class: 'select', style: { height: '34px', fontSize: '12.5px', width: 'auto', minWidth: '200px' }, onchange: (e) => { filtroContrato = e.target.value; paint(); } }, [
      el('option', { value: 'todos' }, 'Todos os contratos'),
      ...contratos.map((c) => el('option', { value: c.id, selected: c.id === filtroContrato }, `${c.nome} · ${c.clienteNome}`))
    ]);
    const lista = filtroContrato === 'todos' ? projetos : projetos.filter((p) => p.contratoId === filtroContrato);

    const body = lista.length === 0
      ? emptyState({
          icon: icon.folder(36),
          title: projetos.length ? 'Nenhum projeto neste contrato' : 'Nenhum projeto planejado',
          message: contratos.length ? 'Clique em "Novo projeto" para montar a ficha e as etapas.' : 'Cadastre um cliente e um contrato primeiro.'
        })
      : el('div', { class: 'project-grid' }, lista.map(projetoCard));

    return cardWithHeader({
      title: 'Projetos',
      subtitle: 'Clique em um projeto para ver a ficha, as etapas e o planejado × real',
      actions: [
        contratos.length ? filtroSel : null,
        button({ label: 'Novo projeto', size: 'sm', variant: 'primary', icon: icon.plus(15), disabled: contratos.length === 0, onClick: () => modalProjeto() })
      ],
      children: [body]
    });
  }

  /** Base de planejamento no Excel: baixar, editar fora do app e enviar de volta. */
  function cardPlanilha() {
    const arquivo = el('input', { type: 'file', accept: '.xlsx,.xls', style: { display: 'none' }, onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const { lerBase } = await import('../../lib/planilhaBase.js');
        mostrarPlano(await lerBase(file, { atividades, projetos }));
      } catch {
        toast('Não foi possível ler a planilha. Confira se é o arquivo baixado aqui.', 'error');
      }
    } });
    const passos = ['Baixe a planilha', 'Edite no Excel: durações, MOD, horários, restrições e catálogo', 'Envie de volta — o app mostra o que vai mudar antes de gravar'];
    return cardWithHeader({
      title: 'Planilha de planejamento (Excel)',
      subtitle: 'Para editar muita coisa de uma vez, fora do app',
      actions: [
        button({ label: 'Baixar planilha', size: 'sm', variant: 'outline', icon: icon.download(15), onClick: async () => {
          const { exportarBase } = await import('../../lib/planilhaBase.js');
          await exportarBase({ atividades, projetos, lancamentos });
        } }),
        button({ label: 'Enviar planilha editada', size: 'sm', variant: 'primary', icon: icon.upload(15), onClick: () => arquivo.click() }),
        arquivo
      ],
      children: [el('div', { class: 'guide-steps' }, passos.map((t, i) => el('div', { class: 'guide-step' }, [el('span', { class: 'guide-step-num' }, String(i + 1)), el('div', {}, [el('small', { style: { fontSize: '13px', color: 'var(--text-1)' } }, t)])])))]
    });
  }

  /** Prévia do que a planilha vai mudar; só grava após confirmação. */
  function mostrarPlano(plano) {
    const linha = (texto) => el('li', {}, texto);
    const NOMES = { codigo: 'código', nome: 'nome', classificacao: 'Lean', contrato: 'grupo', setor: 'setor', duracaoPadraoMin: 'duração padrão', efetivoPadrao: 'MOD', ativo: 'ativa' };
    const blocos = [];
    if (plano.atividadesNovas.length) blocos.push(el('div', {}, [el('strong', {}, `${plano.atividadesNovas.length} atividade(s) nova(s) no catálogo`), el('ul', { class: 'plan-ul' }, plano.atividadesNovas.slice(0, 8).map((a) => linha(a.nome)))]));
    if (plano.atividadesAlteradas.length) blocos.push(el('div', {}, [el('strong', {}, `${plano.atividadesAlteradas.length} atividade(s) alterada(s)`), el('ul', { class: 'plan-ul' }, plano.atividadesAlteradas.slice(0, 8).map((x) => linha(`${x.atividade.nome}: ${Object.keys(x.patch).map((k) => NOMES[k] || k).join(', ')}`)))]));
    if (plano.projetosAlterados.length) blocos.push(el('div', {}, [el('strong', {}, `${plano.projetosAlterados.length} projeto(s) alterado(s)`), el('ul', { class: 'plan-ul' }, plano.projetosAlterados.map((x) => linha(`${x.projeto.nome} — ${x.itens.join('; ')}`)))]));
    const erros = plano.erros.length
      ? el('div', { class: 'inline-alert warn' }, [el('span', { html: icon.alert(15), style: { display: 'inline-flex' } }), el('div', {}, [el('div', {}, `${plano.erros.length} linha(s) ignorada(s):`), ...plano.erros.slice(0, 6).map((e) => el('div', {}, e))])])
      : null;
    if (!plano.total) {
      openModal({ title: 'Nada para atualizar', body: [el('p', { style: { fontSize: '13.5px', color: 'var(--text-1)' } }, 'A planilha é igual ao que já está no app.'), erros], saveLabel: 'Ok', onSave: () => true });
      return;
    }
    openModal({
      title: 'Conferir alterações da planilha',
      body: [...blocos, erros],
      saveLabel: 'Aplicar alterações',
      onSave: async () => {
        const { aplicarBase } = await import('../../lib/planilhaBase.js');
        await aplicarBase(plano, profile);
        toast('Planejamento atualizado pela planilha.', 'ok');
      }
    });
  }

  function projetoCard(p) {
    const r = resumoProjeto(p, lancamentos);
    const st = statusInfo(p.status);
    return el('button', { class: 'project-card', type: 'button', onclick: () => { abertoId = p.id; paint(); } }, [
      el('div', { class: 'project-card-top' }, [badge(st.label, st.tone, true), r.divergencias.length ? badge(`${r.divergencias.length} divergência(s)`, 'warn') : null]),
      el('strong', { class: 'project-card-title' }, p.nome),
      el('span', { class: 'muted', style: { fontSize: '12px' } }, `${p.clienteNome} › ${p.contratoNome}`),
      meter({ label: 'Etapas iniciadas', ratio: r.progresso, valueLabel: `${r.iniciadas}/${r.etapas.length}` }),
      el('div', { class: 'project-card-foot' }, [
        el('span', {}, ['Planejado ', el('b', { class: 'mono' }, formatMinutes(r.planejadoMin))]),
        el('span', {}, ['Apontado ', el('b', { class: 'mono' }, formatMinutes(r.realMin))])
      ])
    ]);
  }

  // ---------------- modais de cliente / contrato ----------------
  function modalCliente(item) {
    const nome = input({ value: item?.nome || '', placeholder: 'Ex.: Ternium' });
    const unidade = input({ value: item?.unidade || '', placeholder: 'Ex.: Santa Cruz — RJ' });
    openModal({
      title: item ? 'Editar cliente' : 'Novo cliente',
      body: [field({ label: 'Nome do cliente', input: nome }), field({ label: 'Unidade / planta', input: unidade, hint: 'Opcional.' })],
      onSave: async () => {
        if (!nome.value.trim()) { toast('Informe o nome do cliente.', 'error'); return false; }
        if (item) {
          await updateCliente(item.id, { nome: nome.value.trim(), unidade: unidade.value.trim() });
          // mantém o nome do cliente copiado nos contratos/projetos em dia
          await Promise.all([
            ...contratos.filter((c) => c.clienteId === item.id).map((c) => updateContrato(c.id, { clienteNome: nome.value.trim() })),
            ...projetos.filter((p) => p.clienteId === item.id).map((p) => updateProjeto(p.id, { clienteNome: nome.value.trim() }))
          ]);
        } else await addCliente({ nome: nome.value, unidade: unidade.value, criadoPor: profile.uid });
        toast('Cliente salvo.', 'ok');
      }
    });
  }

  function removerCliente(c, seus) {
    if (seus.length) return toast('Remova ou mova os contratos deste cliente antes.', 'error');
    confirmar('Remover cliente?', `"${c.nome}" será removido.`, async () => { await deleteCliente(c.id, c.nome); toast('Cliente removido.', 'ok'); });
  }

  function modalContrato(item, cliente) {
    const nome = input({ value: item?.nome || '', placeholder: 'Ex.: Coqueria' });
    const numero = input({ value: item?.numero || '', placeholder: 'Opcional' });
    const usados = projetos.filter((p) => p.contratoId === item?.id).length;
    openModal({
      title: item ? 'Editar contrato' : `Novo contrato — ${cliente.nome}`,
      body: [
        field({ label: 'Nome do contrato', input: nome }),
        field({ label: 'Número do contrato', input: numero }),
        item
          ? button({
              label: usados ? `Em uso por ${usados} projeto(s)` : 'Remover contrato',
              size: 'sm',
              variant: 'danger',
              disabled: usados > 0,
              icon: icon.trash(14),
              onClick: () => { document.querySelector('.modal-backdrop')?.remove(); confirmar('Remover contrato?', `"${item.nome}" será removido.`, async () => { await deleteContrato(item.id, item.nome); toast('Contrato removido.', 'ok'); }); }
            })
          : null
      ],
      onSave: async () => {
        if (!nome.value.trim()) { toast('Informe o nome do contrato.', 'error'); return false; }
        if (item) {
          await updateContrato(item.id, { nome: nome.value.trim(), numero: numero.value.trim() });
          await Promise.all(projetos.filter((p) => p.contratoId === item.id).map((p) => updateProjeto(p.id, { contratoNome: nome.value.trim() })));
        } else await addContrato({ nome: nome.value, numero: numero.value, clienteId: cliente.id, clienteNome: cliente.nome, criadoPor: profile.uid });
        toast('Contrato salvo.', 'ok');
      }
    });
  }

  // ---------------- modal de projeto (criação + ficha) ----------------
  function modalProjeto(item) {
    const ficha = { ...fichaPadrao(), ...(item?.ficha || {}) };
    const nome = input({ value: item?.nome || '', placeholder: 'Ex.: Reparo bateria 3 — parada de maio' });
    const contratoSel = el('select', { class: 'select', disabled: !!item }, contratos.map((c) =>
      el('option', { value: c.id, selected: c.id === (item?.contratoId || (filtroContrato !== 'todos' ? filtroContrato : '')) }, `${c.nome} · ${c.clienteNome}`)
    ));
    const setorSel = el('select', { class: 'select' }, [
      el('option', { value: '' }, 'Sem setor'),
      // mantém o setor gravado mesmo que tenha saído da lista de setores
      ...[...new Set([...setores.map((s) => s.nome), item?.setor].filter(Boolean))].map((n) => el('option', { value: n, selected: n === item?.setor }, n))
    ]);
    const inicio = input({ type: 'date', value: item?.dataInicio || '' });
    const fim = input({ type: 'date', value: item?.dataFim || '' });
    const escala = el('select', { class: 'select' }, ESCALAS.map((e) => el('option', { value: e.value, selected: e.value === ficha.escala }, e.label)));
    const horas = input({ type: 'number', class: 'input mono', min: '1', max: '24', value: String(ficha.horasPorTurno) });
    const turmas = input({ type: 'number', class: 'input mono', min: '1', value: String(ficha.turmas) });
    const chegada = input({ type: 'time', value: ficha.horaChegada });
    const saida = input({ type: 'time', value: ficha.horaSaida });
    const almIni = input({ type: 'time', value: ficha.almocoInicio });
    const almFim = input({ type: 'time', value: ficha.almocoFim });
    const efetivo = efetivoInputs(ficha.efetivo);
    const restricoes = el('textarea', { class: 'textarea', placeholder: 'Uma por linha. Ex.:\nLiberação de APR antes de iniciar\nTrabalho em altura — exige PT', value: (ficha.restricoes || []).join('\n') });
    const uteis = el('div', { class: 'field-hint mono' });

    const atualizarUteis = () => {
      uteis.textContent = `Tempo útil por dia: ${formatMinutes(minutosUteisDia({ horaChegada: chegada.value, horaSaida: saida.value, almocoInicio: almIni.value, almocoFim: almFim.value }))}`;
    };
    [chegada, saida, almIni, almFim].forEach((i) => i.addEventListener('change', atualizarUteis));
    atualizarUteis();
    escala.addEventListener('change', () => { horas.value = String(escalaInfo(escala.value).horasPadrao); });
    // ao escolher um setor já configurado, herda a escala dele (pode mudar depois)
    setorSel.addEventListener('change', () => {
      const s = setores.find((x) => x.nome === setorSel.value);
      if (!s) return;
      escala.value = s.escala || 'adm';
      horas.value = String(s.horasPorTurno || escalaInfo(s.escala).horasPadrao);
      turmas.value = String(s.turmas || 1);
    });

    openModal({
      title: item ? 'Editar ficha do projeto' : 'Novo projeto',
      body: [
        el('div', { class: 'section-title' }, 'Identificação'),
        field({ label: 'Nome do projeto', input: nome }),
        grid2([field({ label: 'Contrato', input: contratoSel }), field({ label: 'Setor', input: setorSel })]),
        grid2([field({ label: 'Início previsto', input: inicio }), field({ label: 'Término previsto', input: fim })]),
        el('div', { class: 'section-title' }, 'Turno e horários'),
        grid2([field({ label: 'Escala', input: escala }), field({ label: 'Jornada (h/turno)', input: horas })]),
        grid2([field({ label: 'Chegada', input: chegada }), field({ label: 'Saída', input: saida })]),
        grid2([field({ label: 'Almoço — início', input: almIni }), field({ label: 'Almoço — fim', input: almFim })]),
        uteis,
        field({ label: 'Turmas (equipes)', input: turmas }),
        el('div', { class: 'section-title' }, 'MOD planejada (por equipe)'),
        efetivo.node,
        el('div', { class: 'section-title' }, 'Restrições'),
        restricoes
      ],
      onSave: async () => {
        const contrato = contratos.find((c) => c.id === contratoSel.value);
        if (!nome.value.trim()) { toast('Dê um nome ao projeto.', 'error'); return false; }
        if (!contrato) { toast('Escolha o contrato.', 'error'); return false; }
        const novaFicha = {
          escala: escala.value,
          horasPorTurno: horas.value,
          turmas: turmas.value,
          horaChegada: chegada.value,
          horaSaida: saida.value,
          almocoInicio: almIni.value,
          almocoFim: almFim.value,
          efetivo: efetivo.getValue(),
          restricoes: restricoes.value.split('\n')
        };
        const base = { nome: nome.value.trim(), setor: setorSel.value, dataInicio: inicio.value, dataFim: fim.value, ficha: novaFicha };
        if (item) await updateProjeto(item.id, base);
        else {
          const ref = await addProjeto({ ...base, contrato, cliente: clientes.find((c) => c.id === contrato.clienteId), criadoPor: profile.uid });
          abertoId = ref.id; // abre direto no projeto recém-criado para montar as etapas
          paint();
        }
        toast(item ? 'Ficha atualizada.' : 'Projeto criado! Agora adicione as etapas.', 'ok');
      }
    });
  }

  // =====================================================================
  // DETALHE DO PROJETO
  // =====================================================================
  function renderDetalhe(p) {
    const r = resumoProjeto(p, lancamentos);
    const f = { ...fichaPadrao(), ...(p.ficha || {}) };
    const statusSel = el('select', { class: 'select', style: { height: '34px', fontSize: '12.5px', width: 'auto' }, onchange: (e) => updateProjeto(p.id, { status: e.target.value }).then(() => toast('Situação atualizada.', 'ok')) },
      STATUS_PROJETO.map((s) => el('option', { value: s.value, selected: s.value === (p.status || 'planejado') }, s.label)));

    const header = el('div', { class: 'page-header' }, [
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
        button({ iconOnly: true, variant: 'ghost', icon: icon.arrowLeft(18), onClick: () => { abertoId = null; paint(); } }),
        el('div', {}, [el('h2', {}, p.nome), el('p', {}, `${p.clienteNome} › ${p.contratoNome}${p.setor ? ` · setor ${p.setor}` : ''}`)])
      ]),
      el('div', { class: 'toolbar' }, [
        statusSel,
        button({ label: 'Editar ficha', size: 'sm', variant: 'outline', icon: icon.edit(14), onClick: () => modalProjeto(p) }),
        button({ iconOnly: true, size: 'sm', variant: 'danger', icon: icon.trash(14), onClick: () => confirmar('Remover projeto?', 'Os lançamentos já feitos continuam no histórico.', async () => { await deleteProjeto(p.id, p.nome); abertoId = null; toast('Projeto removido.', 'ok'); }) })
      ])
    ]);

    const fichaCard = cardWithHeader({
      title: 'Ficha do projeto',
      subtitle: 'O que o apontador recebe pronto em campo',
      children: [
        el('div', { class: 'kv-grid' }, [
          kv('Escala', `${escalaLabel(f.escala)} · ${f.horasPorTurno}h`),
          kv('Horário', `${f.horaChegada} às ${f.horaSaida}`),
          kv('Almoço', f.almocoInicio && f.almocoFim ? `${f.almocoInicio} às ${f.almocoFim}` : '—'),
          kv('Tempo útil/dia', formatMinutes(minutosUteisDia(f))),
          kv('Turmas', String(f.turmas)),
          kv('Período', p.dataInicio ? `${formatDateBR(p.dataInicio)} a ${formatDateBR(p.dataFim)}` : '—'),
          kv('MOD por equipe', efetivoTotal(f.efetivo) ? formatEfetivo(f.efetivo) : '—', true)
        ]),
        f.restricoes?.length
          ? el('div', { class: 'chip-row', style: { marginTop: '14px' } }, f.restricoes.map((t) => el('span', { class: 'chip chip-warn' }, [el('span', { html: icon.alert(12) }), t])))
          : null
      ]
    });

    const desvioTotal = r.realMin - r.planejadoExecMin; // real × planejado das execuções feitas
    const kpis = el('div', { class: 'grid grid-kpis' }, [
      statTile({ label: 'Etapas iniciadas', value: `${r.iniciadas}/${r.etapas.length}`, iconHtml: icon.target(15) }),
      statTile({ label: 'Planejado (total)', value: formatMinutes(r.planejadoMin), iconHtml: icon.calendar(15), tone: 'info' }),
      statTile({ label: 'Apontado nas etapas', value: formatMinutes(r.realMin), iconHtml: icon.clock(15), tone: 'ok' }),
      statTile({ label: 'Desvio nas iniciadas', value: `${desvioTotal > 0 ? '+' : desvioTotal < 0 ? '−' : ''}${formatMinutes(Math.abs(desvioTotal))}`, iconHtml: icon.alert(15), tone: desvioTotal > 0 ? 'danger' : 'ok' }),
      statTile({ label: 'Improdutivo', value: formatMinutes(r.improdutivoMin), iconHtml: icon.x(15), tone: 'warn' })
    ]);

    return [header, kpis, el('div', { class: 'grid grid-2' }, [fichaCard, cardDivergencias(r)]), cardEtapas(p, r)];
  }

  function kv(k, v, wide) {
    return el('div', { class: `kv${wide ? ' kv-wide' : ''}` }, [el('span', {}, k), el('strong', {}, v)]);
  }

  function cardDivergencias(r) {
    const itens = r.divergencias.slice(0, 12);
    return cardWithHeader({
      title: 'Divergências de campo',
      subtitle: 'Onde o real foi diferente do planejado',
      children: [
        itens.length === 0
          ? emptyState({ icon: icon.check(30), title: 'Sem divergências', message: r.lancamentos.length ? 'Tudo dentro do planejado até agora.' : 'Ainda não há apontamentos neste projeto.' })
          : el('div', { class: 'div-list' }, itens.map((l) => {
              const difs = efetivoDiferencas(l.efetivo, l.efetivoPadrao);
              return el('div', { class: 'div-item' }, [
                el('div', { class: 'div-item-head' }, [el('strong', {}, l.atividadeNome), el('span', { class: 'muted mono' }, `${formatDateBR(l.data)} · ${l.criadoPorNome || ''}`)]),
                Number(l.excedenteMin) > 0 ? el('div', { class: 'div-line warn' }, `Tempo: ${formatMinutes(l.duracaoPadraoMin)} planejado → ${formatMinutes(l.duracaoMinutos)} real (+${formatMinutes(l.excedenteMin)})`) : null,
                difs.length ? el('div', { class: 'div-line info' }, `Efetivo: ${formatDiferencas(difs)}`) : null,
                l.justificativa ? el('div', { class: 'div-line muted' }, `“${l.justificativa}”`) : null
              ]);
            }))
      ]
    });
  }

  function cardEtapas(p, r) {
    const etapas = p.etapas || [];
    const salvarEtapas = (novas, msg) => updateProjeto(p.id, { etapas: novas }).then(() => msg && toast(msg, 'ok')).catch(() => toast('Não foi possível salvar.', 'error'));

    const body = etapas.length === 0
      ? emptyState({ icon: icon.list(34), title: 'Nenhuma etapa planejada', message: 'Adicione as etapas a partir do catálogo de atividades. Depois ajuste a duração e a MOD de cada uma.' })
      : el('div', { class: 'table-wrap' }, [
          el('table', { class: 'data-table' }, [
            el('thead', {}, el('tr', {}, ['#', 'Etapa', 'Lean', 'Duração plan.', 'MOD plan.', 'Real (por execução)', 'Desvio', 'Efetivo real', ''].map((h) => el('th', {}, h)))),
            el('tbody', {}, r.etapas.map((e, idx) => {
              const dur = el('input', { class: 'input mono input-compact', type: 'number', min: '0', step: '5', value: String(e.etapa.duracaoMin || 0), title: 'Minutos',
                onchange: (ev) => salvarEtapas(etapas.map((x) => (x.id === e.etapa.id ? { ...x, duracaoMin: ev.target.value } : x)), 'Duração atualizada.') });
              const info = CLASSIFICACAO_INFO[e.etapa.classificacao] || CLASSIFICACAO_INFO.DN;
              const desvio = e.lancamentos ? e.desvioMin : null;
              return el('tr', {}, [
                el('td', { class: 'mono muted' }, e.etapa.codigo || String(idx + 1)),
                el('td', { class: 'strong' }, e.etapa.nome),
                el('td', {}, el('span', { style: { color: info.color, fontWeight: '700', fontSize: '12px' } }, info.short)),
                el('td', {}, el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [dur, el('span', { class: 'muted', style: { fontSize: '11.5px' } }, 'min')])),
                el('td', {}, el('button', { class: 'chip', type: 'button', title: 'Editar MOD da etapa', onclick: () => modalMODEtapa(p, e.etapa) }, efetivoTotal(e.etapa.efetivo) ? `${efetivoTotal(e.etapa.efetivo)} pessoa${efetivoTotal(e.etapa.efetivo) > 1 ? 's' : ''}` : 'definir')),
                el('td', { class: 'mono' }, e.lancamentos
                  ? [formatMinutes(e.mediaMin), e.lancamentos > 1 ? el('div', { class: 'muted', style: { fontSize: '11px' } }, `média de ${e.lancamentos}×`) : null]
                  : '—'),
                el('td', { class: 'mono', style: { color: desvio == null ? 'var(--text-3)' : desvio > 0 ? 'var(--danger-500)' : 'var(--ok-500)', fontWeight: '700' } },
                  desvio == null ? '—' : `${desvio > 0 ? '+' : desvio < 0 ? '−' : ''}${formatMinutes(Math.abs(desvio))}`),
                el('td', { style: { fontSize: '12px' } }, !e.lancamentos ? '—' : e.difEfetivo.length ? el('span', { style: { color: 'var(--info-500)' } }, formatDiferencas(e.difEfetivo)) : el('span', { style: { color: 'var(--ok-500)' } }, 'conforme')),
                el('td', {}, el('div', { class: 'toolbar', style: { flexWrap: 'nowrap', gap: '2px' } }, [
                  button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.arrowUp(14), disabled: idx === 0, onClick: () => salvarEtapas(mover(etapas, idx, -1)) }),
                  button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.arrowDown(14), disabled: idx === etapas.length - 1, onClick: () => salvarEtapas(mover(etapas, idx, 1)) }),
                  button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.trash(14), onClick: () => salvarEtapas(etapas.filter((x) => x.id !== e.etapa.id), 'Etapa removida.') })
                ]))
              ]);
            }))
          ])
        ]);

    return cardWithHeader({
      title: 'Etapas planejadas × realizado',
      subtitle: 'Duração e MOD de cada etapa chegam pré-preenchidas no celular do apontador',
      actions: [button({ label: 'Adicionar etapas', size: 'sm', variant: 'primary', icon: icon.plus(15), onClick: () => modalAddEtapas(p) })],
      children: [body]
    });
  }

  function mover(lista, idx, dir) {
    const out = [...lista];
    const [item] = out.splice(idx, 1);
    out.splice(idx + dir, 0, item);
    return out;
  }

  function modalMODEtapa(p, etapa) {
    const ef = efetivoInputs(etapa.efetivo || {});
    openModal({
      title: `MOD — ${etapa.nome}`,
      body: [ef.node, el('div', { class: 'field-hint' }, 'Quantidade planejada para executar esta etapa.')],
      onSave: async () => {
        await updateProjeto(p.id, { etapas: p.etapas.map((x) => (x.id === etapa.id ? { ...x, efetivo: ef.getValue() } : x)) });
        toast('MOD da etapa atualizada.', 'ok');
      }
    });
  }

  /** Escolhe etapas do catálogo (produtivas) para o projeto, com busca e filtro por grupo. */
  function modalAddEtapas(p) {
    const jaTem = new Set((p.etapas || []).map((e) => e.atividadeId));
    const catalogo = atividades.filter((a) => a.tipo === 'produtiva' && a.ativo !== false && !jaTem.has(a.id));
    const grupos = [...new Set(catalogo.map((a) => a.contrato).filter(Boolean))].sort();
    const marcadas = new Set();
    let grupo = grupos.includes(p.contratoNome) ? p.contratoNome : 'todos';
    let busca = '';

    const lista = el('div', { class: 'check-list' });
    const contador = el('span', { class: 'muted', style: { fontSize: '12.5px' } }, '0 selecionada(s)');
    const buscaInput = input({ placeholder: 'Buscar etapa…', oninput: (e) => { busca = e.target.value.toLowerCase(); pintar(); } });
    const grupoSel = el('select', { class: 'select', onchange: (e) => { grupo = e.target.value; pintar(); } }, [
      el('option', { value: 'todos' }, 'Todos os grupos'),
      ...grupos.map((g) => el('option', { value: g, selected: g === grupo }, g))
    ]);

    function visiveis() {
      return catalogo.filter((a) => (grupo === 'todos' || a.contrato === grupo) && (!busca || `${a.codigo} ${a.nome}`.toLowerCase().includes(busca)));
    }
    function pintar() {
      const vs = visiveis();
      contador.textContent = `${marcadas.size} selecionada(s)`;
      mount(lista, vs.length
        ? vs.map((a) => el('label', { class: 'check-item' }, [
            el('input', { type: 'checkbox', checked: marcadas.has(a.id), onchange: (e) => { e.target.checked ? marcadas.add(a.id) : marcadas.delete(a.id); contador.textContent = `${marcadas.size} selecionada(s)`; } }),
            el('span', { class: 'mono muted' }, a.codigo || ''),
            el('span', {}, a.nome),
            a.duracaoPadraoMin ? el('span', { class: 'mono muted', style: { marginLeft: 'auto' } }, formatMinutes(a.duracaoPadraoMin)) : null
          ]))
        : [el('div', { class: 'muted', style: { padding: '18px', textAlign: 'center', fontSize: '13px' } }, catalogo.length ? 'Nada encontrado.' : 'Todas as atividades do catálogo já estão no projeto — cadastre novas em Cadastros.')]);
    }
    pintar();

    openModal({
      title: 'Adicionar etapas do catálogo',
      saveLabel: 'Adicionar',
      body: [
        grid2([grupoSel, buscaInput]),
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
          contador,
          button({ label: 'Marcar todas visíveis', size: 'sm', variant: 'ghost', onClick: () => { visiveis().forEach((a) => marcadas.add(a.id)); pintar(); } })
        ]),
        lista
      ],
      onSave: async () => {
        if (!marcadas.size) { toast('Marque pelo menos uma etapa.', 'error'); return false; }
        // mantém a ordem do catálogo (código) e herda o padrão da atividade como ponto de partida
        const novas = catalogo.filter((a) => marcadas.has(a.id)).map((a) => ({
          atividadeId: a.id,
          codigo: a.codigo || '',
          nome: a.nome,
          classificacao: a.classificacao,
          duracaoMin: a.duracaoPadraoMin || 0,
          efetivo: efetivoTotal(a.efetivoPadrao) ? a.efetivoPadrao : (p.ficha?.efetivo || {})
        }));
        await updateProjeto(p.id, { etapas: [...(p.etapas || []), ...novas] });
        toast(`${novas.length} etapa(s) adicionada(s).`, 'ok');
      }
    });
  }

  paint();

  return {
    node,
    update(newCtx) {
      ({ clientes, contratos, projetos, atividades, setores, lancamentos } = newCtx);
      // não repinta enquanto há um campo em edição na página (evita perder o foco)
      if (node.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
      paint();
    }
  };
}
