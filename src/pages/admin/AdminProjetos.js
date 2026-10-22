import { el, mount } from '../../utils/dom.js';
import { badge, button, emptyState, field, modal, cardWithHeader } from '../../components/ui.js';
import { statTile, meter } from '../../components/charts.js';
import { efetivoInputs } from '../../components/EfetivoInputs.js';
import { wizard, rascunho } from '../../components/Wizard.js';
import { editorAtividades, validarAtividades } from './EditorAtividades.js';
import { vincularAtividades } from '../../lib/activities.js';
import { SEED_ATIVIDADES } from '../../data/seedAtividades.js';
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

/** Modelos prontos de atividades (catálogo padrão da Reframax), agrupados por serviço. */
const MODELOS = Object.entries(
  SEED_ATIVIDADES.reduce((grupos, a) => {
    (grupos[a.contrato] ||= []).push({ nome: a.nome, codigo: a.codigo, classificacao: a.classificacao });
    return grupos;
  }, {})
).map(([nome, itens]) => ({ nome, itens }));

const copia = (x) => JSON.parse(JSON.stringify(x));

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
  let criando = null; // assistente de novo projeto aberto
  const chaveRascunho = `projeto.${profile.uid}`;

  const node = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } });

  function paint() {
    if (criando) return; // o assistente se redesenha sozinho
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
          message: contratos.length ? 'Clique em "Novo projeto": o assistente monta a ficha e as atividades passo a passo.' : 'Cadastre um cliente e um contrato primeiro.'
        })
      : el('div', { class: 'project-grid' }, lista.map(projetoCard));

    return cardWithHeader({
      title: 'Projetos',
      subtitle: 'Clique em um projeto para ver a ficha, as etapas e o planejado × real',
      actions: [
        contratos.length ? filtroSel : null,
        rascunho(chaveRascunho).ler() ? button({ label: 'Continuar projeto em criação', size: 'sm', variant: 'outline', icon: icon.bolt(15), onClick: () => abrirAssistente(true) }) : null,
        button({ label: 'Novo projeto', size: 'sm', variant: 'primary', icon: icon.plus(15), disabled: contratos.length === 0, onClick: () => abrirAssistente(false) })
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
        mostrarPlano(await lerBase(file, { projetos }));
      } catch {
        toast('Não foi possível ler a planilha. Confira se é o arquivo baixado aqui.', 'error');
      }
    } });
    const passos = ['Baixe a planilha', 'Edite no Excel: horários, equipe, restrições e as atividades de cada projeto', 'Envie de volta — o app mostra o que vai mudar antes de gravar'];
    return cardWithHeader({
      title: 'Planilha de planejamento (Excel)',
      subtitle: 'Para editar muita coisa de uma vez, fora do app',
      actions: [
        button({ label: 'Baixar planilha', size: 'sm', variant: 'outline', icon: icon.download(15), onClick: async () => {
          const { exportarBase } = await import('../../lib/planilhaBase.js');
          await exportarBase({ projetos, lancamentos });
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
    const blocos = [];
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
        await aplicarBase(plano, { atividades, profile });
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
      meter({ label: 'Etapas iniciadas', ratio: r.progresso, valueLabel: `${r.iniciadas}/${r.etapas.length}`, color: 'var(--ok-500)' }),
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

  // ---------------- edição da ficha de um projeto existente ----------------
  function modalProjeto(item) {
    const ficha = { ...fichaPadrao(), ...(item?.ficha || {}) };
    const nome = input({ value: item?.nome || '', placeholder: 'Ex.: Reparo bateria 3 — parada de maio' });
    const contratoSel = el('select', { class: 'select', disabled: true }, contratos.map((c) =>
      el('option', { value: c.id, selected: c.id === item.contratoId }, `${c.nome} · ${c.clienteNome}`)
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
      title: 'Editar ficha do projeto',
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
        await updateProjeto(item.id, { nome: nome.value.trim(), setor: setorSel.value, dataInicio: inicio.value, dataFim: fim.value, ficha: novaFicha });
        toast('Ficha atualizada.', 'ok');
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

    return [header, kpis, el('div', { class: 'grid grid-2' }, [fichaCard, cardDivergencias(r)]), cardEtapas(p, r), cardImprodutividades(p)];
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
      ? emptyState({ icon: icon.list(34), title: 'Nenhuma atividade planejada', message: 'Clique em "Editar atividades" para montar a lista: nome, VA/DN, tempo padrão e colaboradores.' })
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
      title: 'Atividades planejadas × realizado',
      subtitle: 'Tempo padrão e colaboradores de cada atividade chegam pré-preenchidos no celular do apontador',
      actions: [button({ label: 'Editar atividades', size: 'sm', variant: 'primary', icon: icon.edit(14), onClick: () => modalAtividades(p, 'produtiva') })],
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

  // =====================================================================
  // ATIVIDADES DO PROJETO (criação e edição)
  // =====================================================================

  /** Edita a lista de atividades (produtivas ou improdutividades) de um projeto existente. */
  function modalAtividades(p, tipo) {
    const produtiva = tipo === 'produtiva';
    const itens = copia((produtiva ? p.etapas : p.improdutividades) || []);
    const editor = editorAtividades({ itens, tipo, equipePadrao: p.ficha?.efetivo, modelos: MODELOS, projetos: projetos.filter((x) => x.id !== p.id) });
    const close = () => backdrop.remove();
    const salvar = button({ label: 'Salvar', variant: 'primary', onClick: async () => {
      const erro = validarAtividades(itens, tipo);
      if (erro) return toast(erro, 'error');
      salvar.disabled = true;
      try {
        const vinculados = await vincularAtividades(itens, tipo, atividades, { contrato: p.contratoNome, criadoPor: profile.uid });
        await updateProjeto(p.id, produtiva ? { etapas: vinculados } : { improdutividades: vinculados });
        toast(produtiva ? 'Atividades do projeto salvas.' : 'Improdutividades do projeto salvas.', 'ok');
        close();
      } catch {
        salvar.disabled = false;
        toast('Não foi possível salvar. Tente novamente.', 'error');
      }
    } });
    const backdrop = modal({
      title: produtiva ? `Atividades — ${p.nome}` : `Improdutividades — ${p.nome}`,
      largo: true,
      body: [
        el('p', { class: 'muted', style: { fontSize: '13px', lineHeight: '1.5' } }, produtiva
          ? 'O que a equipe vai executar. Tempo padrão e colaboradores chegam pré-preenchidos no celular do apontador.'
          : 'Paradas que podem acontecer neste projeto. O apontador escolhe entre elas ao lançar uma improdutividade.'),
        editor.node
      ],
      footer: [button({ label: 'Cancelar', variant: 'ghost', onClick: close }), salvar],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  function cardImprodutividades(p) {
    const lista = p.improdutividades || [];
    return cardWithHeader({
      title: 'Improdutividades previstas',
      subtitle: 'Paradas que o apontador pode registrar neste projeto — DN inevitável, DNN evitável',
      actions: [button({ label: 'Editar improdutividades', size: 'sm', variant: 'outline', icon: icon.edit(14), onClick: () => modalAtividades(p, 'improdutiva') })],
      children: [lista.length
        ? el('div', { class: 'chip-row' }, lista.map((i) => el('span', { class: `chip chip-classe chip-${i.classificacao}` }, [el('b', {}, i.classificacao), i.nome])))
        : el('div', { class: 'muted', style: { fontSize: '13px' } }, 'Nenhuma definida — o celular mostra a lista geral de improdutividades.')]
    });
  }

  /** Assistente de criação: ficha + atividades + improdutividades, passo a passo. */
  function abrirAssistente(continuar) {
    const draft = rascunho(chaveRascunho);
    if (!continuar) draft.limpar();
    const estado = (continuar && draft.ler()) || {
      nome: '',
      contratoId: filtroContrato !== 'todos' ? filtroContrato : contratos[0]?.id || '',
      setor: '',
      dataInicio: '',
      dataFim: '',
      ficha: fichaPadrao(),
      etapas: [],
      improdutividades: []
    };
    criando = wizard({
      titulo: 'Novo projeto',
      iconeHtml: icon.folder(22),
      passos: passosNovoProjeto(),
      estado,
      rascunhoChave: chaveRascunho,
      rotuloConcluir: 'Criar projeto',
      aoSair: () => { criando = null; paint(); },
      aoConcluir: async (st) => {
        const contrato = contratos.find((c) => c.id === st.contratoId);
        const etapas = await vincularAtividades(st.etapas, 'produtiva', atividades, { contrato: contrato.nome, criadoPor: profile.uid });
        const improdutividades = await vincularAtividades(st.improdutividades, 'improdutiva', atividades, { criadoPor: profile.uid });
        abertoId = await addProjeto({
          nome: st.nome, contrato, cliente: clientes.find((c) => c.id === contrato.clienteId), setor: st.setor,
          dataInicio: st.dataInicio, dataFim: st.dataFim, ficha: st.ficha, etapas, improdutividades, criadoPor: profile.uid
        });
        toast('Projeto criado! Ele já aparece no celular dos apontadores.', 'ok');
        criando = null;
        paint();
      }
    });
    mount(node, [criando.node]);
    window.scrollTo?.({ top: 0 });
  }

  function passosNovoProjeto() {
    const texto = (st, chave, props = {}) => input({ value: st[chave] || '', oninput: (e) => { st[chave] = e.target.value; }, ...props });
    return [
      {
        titulo: 'Identificação',
        ajuda: 'Dê um nome fácil de reconhecer em campo (ex.: "Reparo do duto coletor — Bateria 3") e escolha o contrato. As datas servem para o Assistente avisar se o prazo estiver em risco.',
        render: (st, atualizar) => {
          const guardar = () => atualizar({ repintar: false });
          const setorSel = el('select', { class: 'select', onchange: (e) => {
            st.setor = e.target.value;
            const s = setores.find((x) => x.nome === st.setor);
            if (s) Object.assign(st.ficha, { escala: s.escala || 'adm', horasPorTurno: s.horasPorTurno || escalaInfo(s.escala).horasPadrao, turmas: s.turmas || 1 });
            guardar();
          } }, [el('option', { value: '' }, 'Sem setor'), ...setores.map((x) => el('option', { value: x.nome, selected: x.nome === st.setor }, x.nome))]);
          return el('div', { class: 'wiz-form' }, [
            field({ label: 'Nome do projeto', input: texto(st, 'nome', { placeholder: 'Ex.: Reparo do duto coletor — Bateria 3', oninput: (e) => { st.nome = e.target.value; guardar(); } }) }),
            grid2([
              field({ label: 'Contrato', input: el('select', { class: 'select', onchange: (e) => { st.contratoId = e.target.value; guardar(); } }, contratos.map((c) => el('option', { value: c.id, selected: c.id === st.contratoId }, `${c.nome} · ${c.clienteNome}`))) }),
              field({ label: 'Setor', input: setorSel })
            ]),
            grid2([
              field({ label: 'Início previsto', input: texto(st, 'dataInicio', { type: 'date', onchange: (e) => { st.dataInicio = e.target.value; guardar(); } }) }),
              field({ label: 'Término previsto', input: texto(st, 'dataFim', { type: 'date', onchange: (e) => { st.dataFim = e.target.value; guardar(); } }) })
            ])
          ]);
        },
        validar: (st) => (!st.nome.trim() ? 'Dê um nome ao projeto.' : !contratos.some((c) => c.id === st.contratoId) ? 'Escolha o contrato.' : st.dataInicio && st.dataFim && st.dataFim < st.dataInicio ? 'O término não pode ser antes do início.' : null)
      },
      {
        titulo: 'Turno e horários',
        ajuda: 'A escala e os horários definem o tempo útil por dia — base do takt time e da capacidade. O almoço é descontado automaticamente.',
        render: (st, atualizar) => {
          const f = st.ficha;
          const uteis = el('div', { class: 'field-hint mono' });
          const mostrarUteis = () => { uteis.textContent = `Tempo útil por dia: ${formatMinutes(minutosUteisDia(f))} · ${f.turmas || 1} turma(s)`; };
          const campo = (chave, props) => input({ value: String(f[chave] ?? ''), onchange: (e) => { f[chave] = e.target.value; mostrarUteis(); atualizar({ repintar: false }); }, ...props });
          const horas = campo('horasPorTurno', { type: 'number', class: 'input mono', min: '1', max: '24' });
          mostrarUteis();
          return el('div', { class: 'wiz-form' }, [
            grid2([
              field({ label: 'Escala', input: el('select', { class: 'select', onchange: (e) => { f.escala = e.target.value; f.horasPorTurno = escalaInfo(f.escala).horasPadrao; horas.value = String(f.horasPorTurno); atualizar({ repintar: false }); } }, ESCALAS.map((x) => el('option', { value: x.value, selected: x.value === f.escala }, x.label))) }),
              field({ label: 'Jornada (h/turno)', input: horas })
            ]),
            grid2([field({ label: 'Chegada', input: campo('horaChegada', { type: 'time' }) }), field({ label: 'Saída', input: campo('horaSaida', { type: 'time' }) })]),
            grid2([field({ label: 'Almoço — início', input: campo('almocoInicio', { type: 'time' }) }), field({ label: 'Almoço — fim', input: campo('almocoFim', { type: 'time' }) })]),
            field({ label: 'Turmas (equipes ao mesmo tempo)', input: campo('turmas', { type: 'number', class: 'input mono', min: '1' }) }),
            uteis
          ]);
        }
      },
      {
        titulo: 'Equipe e restrições',
        ajuda: 'A equipe (MOD) de cada turma vira o ponto de partida das atividades. Restrições aparecem em destaque no celular do apontador (ex.: APR, permissão de trabalho).',
        render: (st, atualizar) => {
          const ef = efetivoInputs(st.ficha.efetivo || {}, () => { st.ficha.efetivo = ef.getValue(); atualizar({ repintar: false }); });
          return el('div', { class: 'wiz-form' }, [
            el('div', { class: 'field-label' }, 'Equipe planejada por turma'),
            ef.node,
            field({ label: 'Restrições (uma por linha)', input: el('textarea', { class: 'textarea', placeholder: 'Ex.:\nLiberação de APR antes de iniciar\nTrabalho em altura — exige PT', value: (st.ficha.restricoes || []).join('\n'),
              oninput: (e) => { st.ficha.restricoes = e.target.value.split('\n'); atualizar({ repintar: false }); } }) })
          ]);
        }
      },
      {
        titulo: 'Atividades',
        ajuda: [
          'Liste o que a equipe vai executar. Para cada atividade diga se ela agrega valor (VA — transforma o serviço) ou é necessária (DN — prepara: andaime, demolição, limpeza).',
          'Informe o tempo padrão e quantas pessoas de cada função. Dá para começar de um modelo pronto ou copiar de outro projeto.'
        ],
        render: (st, atualizar) => editorAtividades({ itens: st.etapas, tipo: 'produtiva', equipePadrao: st.ficha.efetivo, modelos: MODELOS, projetos, aoMudar: () => atualizar({ repintar: false }) }).node,
        validar: (st) => (st.etapas.length ? validarAtividades(st.etapas, 'produtiva') : 'Inclua pelo menos uma atividade.')
      },
      {
        titulo: 'Improdutividades',
        ajuda: 'Paradas que podem acontecer neste projeto. DN é inevitável hoje (chuva, DDS); DNN é desperdício evitável (espera de APR, falta de material). Toque nas sugestões para incluir.',
        render: (st, atualizar) => editorAtividades({ itens: st.improdutividades, tipo: 'improdutiva', projetos, aoMudar: () => atualizar({ repintar: false }) }).node,
        validar: (st) => validarAtividades(st.improdutividades, 'improdutiva')
      },
      {
        titulo: 'Revisar',
        ajuda: 'Confira e clique em "Criar projeto". Tudo pode ser alterado depois, dentro do projeto.',
        render: (st) => {
          const f = st.ficha;
          const contrato = contratos.find((c) => c.id === st.contratoId);
          const totalMin = st.etapas.reduce((x, e) => x + (Number(e.duracaoMin) || 0), 0);
          return el('div', { class: 'wiz-form' }, [
            el('div', { class: 'kv-grid' }, [
              kv('Projeto', st.nome || '—', true),
              kv('Contrato', contrato ? `${contrato.nome} · ${contrato.clienteNome}` : '—'),
              kv('Período', st.dataInicio ? `${formatDateBR(st.dataInicio)} a ${formatDateBR(st.dataFim)}` : '—'),
              kv('Turno', `${escalaLabel(f.escala)} · ${f.horaChegada} às ${f.horaSaida}`),
              kv('Tempo útil/dia', formatMinutes(minutosUteisDia(f))),
              kv('Equipe por turma', efetivoTotal(f.efetivo) ? formatEfetivo(f.efetivo) : '—', true),
              kv('Atividades', `${st.etapas.length} (${formatMinutes(totalMin)} planejados)`),
              kv('Improdutividades', String(st.improdutividades.length))
            ]),
            el('div', { class: 'chip-row' }, st.etapas.map((e) => el('span', { class: `chip chip-classe chip-${e.classificacao}` }, [el('b', {}, e.classificacao), `${e.nome} · ${formatMinutes(e.duracaoMin)}`])))
          ]);
        }
      }
    ];
  }

  paint();

  return {
    node,
    update(newCtx) {
      ({ clientes, contratos, projetos, atividades, setores, lancamentos } = newCtx);
      if (criando) return; // não interrompe o assistente de novo projeto
      // não repinta enquanto há um campo em edição na página (evita perder o foco)
      if (node.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
      paint();
    }
  };
}
