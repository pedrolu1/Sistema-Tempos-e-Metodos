import { el, mount } from '../../utils/dom.js';
import { button, modal } from '../../components/ui.js';
import { efetivoInputs } from '../../components/EfetivoInputs.js';
import { icon } from '../../utils/icons.js';
import { efetivoTotal, formatEfetivo } from '../../utils/format.js';
import { sanitizeEtapa, sanitizeImprodutividade } from '../../lib/projetos.js';
import { toast } from '../../lib/toast.js';

/** Causas comuns de parada em campo — atalho para montar a lista do projeto. */
const SUGESTOES_IMPROD = [
  ['Aguardando liberação de APR/PT', 'DNN'],
  ['Falta de material', 'DNN'],
  ['Aguardando liberação da área pela operação', 'DNN'],
  ['Equipamento / munk indisponível', 'DNN'],
  ['Chuva / condição climática', 'DN'],
  ['Deslocamento até a frente de serviço', 'DN'],
  ['DDS / reunião de segurança', 'DN'],
  ['Retrabalho', 'DNN']
];

const CLASSES = {
  produtiva: [['VA', 'VA — agrega valor', 'transforma o serviço: assentar, aplicar, montar'], ['DN', 'DN — necessária', 'prepara o serviço: andaime, demolição, limpeza, inspeção']],
  improdutiva: [['DN', 'DN — inevitável', 'parada que não dá para evitar hoje: chuva, DDS'], ['DNN', 'DNN — evitável', 'perda que dá para eliminar: espera, falta de material']]
};

/**
 * Editor da lista de atividades de um projeto (produtivas ou
 * improdutividades). Cada atividade é um cartão com nome, classificação
 * Lean e — nas produtivas — tempo padrão e equipe. Editar o texto não
 * redesenha a lista (não perde o foco); incluir/remover/mover redesenha.
 *
 * opções: { itens, tipo, equipePadrao, modelos, projetos, aoMudar }
 *   modelos: [{ nome, itens }] (listas prontas para começar)
 *   projetos: outros projetos, para copiar a lista de um deles
 */
export function editorAtividades({ itens, tipo, equipePadrao = {}, modelos = [], projetos = [], aoMudar = () => {} }) {
  const produtiva = tipo === 'produtiva';
  const lista = itens; // edita o próprio array recebido (o assistente guarda o rascunho)
  const corpo = el('div', { class: 'atv-list' });
  const node = el('div', { class: 'atv-editor' }, [corpo, el('div', { class: 'toolbar atv-acoes' }, botoes())]);

  const novo = (dados = {}) =>
    produtiva
      ? sanitizeEtapa({ classificacao: 'DN', duracaoMin: 60, efetivo: equipePadrao, ...dados })
      : sanitizeImprodutividade({ classificacao: 'DNN', ...dados });

  function adicionar(novos) {
    const nomes = new Set(lista.map((i) => i.nome.toLowerCase()));
    let n = 0;
    novos.forEach((d) => {
      if (d.nome && nomes.has(d.nome.toLowerCase())) return; // não duplica
      lista.push(novo(d));
      if (d.nome) nomes.add(d.nome.toLowerCase());
      n++;
    });
    pintar();
    aoMudar();
    return n;
  }

  function botoes() {
    const arquivo = el('input', { type: 'file', accept: '.xlsx,.xls,.csv,.tsv,.txt', style: { display: 'none' }, onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const { parseAtividadesArquivo } = await import('../../lib/importAtividades.js');
        const lidos = (await parseAtividadesArquivo(file)).filter((x) => (x.tipo === 'improdutiva') === !produtiva);
        const n = adicionar(lidos.map((x) => ({ nome: x.nome, codigo: x.codigo, classificacao: x.classificacao, duracaoMin: x.duracaoPadraoMin || 60 })));
        toast(n ? `${n} atividade(s) importada(s).` : 'Nenhuma atividade nova encontrada no arquivo.', n ? 'ok' : 'info');
      } catch {
        toast('Não foi possível ler o arquivo.', 'error');
      }
    } });
    return [
      button({ label: produtiva ? 'Adicionar atividade' : 'Adicionar improdutividade', variant: 'primary', size: 'sm', icon: icon.plus(14), onClick: () => {
        adicionar([{}]);
        corpo.querySelector('.atv-card:last-child input')?.focus();
      } }),
      produtiva && modelos.length ? button({ label: 'Usar modelo', variant: 'outline', size: 'sm', icon: icon.list(14), onClick: () => escolherModelo() }) : null,
      projetos.some((p) => (produtiva ? p.etapas : p.improdutividades)?.length) ? button({ label: 'Copiar de outro projeto', variant: 'outline', size: 'sm', icon: icon.folder(14), onClick: () => copiarDeProjeto() }) : null,
      produtiva ? button({ label: 'Importar arquivo', variant: 'ghost', size: 'sm', icon: icon.upload(14), onClick: () => arquivo.click() }) : null,
      arquivo
    ];
  }

  function escolherLista(titulo, opcoes) {
    const close = () => backdrop.remove();
    const backdrop = modal({
      title: titulo,
      body: [el('div', { class: 'menu-list' }, opcoes.map((o) => el('button', { class: 'menu-item', type: 'button', onclick: () => {
        close();
        const n = adicionar(o.itens);
        toast(`${n} incluída(s).`, 'ok');
      } }, [el('span', { html: icon.list(20) }), el('div', {}, [el('strong', {}, o.nome), el('small', {}, `${o.itens.length} atividade(s)`)])])))],
      footer: [button({ label: 'Cancelar', variant: 'ghost', onClick: close })],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  const escolherModelo = () => escolherLista('Começar a partir de um modelo', modelos);
  const copiarDeProjeto = () =>
    escolherLista('Copiar atividades de outro projeto', projetos
      .map((p) => ({ nome: `${p.nome} — ${p.contratoNome}`, itens: (produtiva ? p.etapas : p.improdutividades) || [] }))
      .filter((o) => o.itens.length)
      .map((o) => ({ ...o, itens: o.itens.map(({ id, ...resto }) => resto) }))); // novo id para cada cópia

  function editarEquipe(item, chip) {
    const ef = efetivoInputs(item.efetivo || {});
    const close = () => backdrop.remove();
    const backdrop = modal({
      title: `Colaboradores — ${item.nome || 'atividade'}`,
      body: [el('p', { class: 'muted', style: { fontSize: '13px' } }, 'Quantas pessoas de cada função são planejadas para executar esta atividade.'), ef.node],
      footer: [
        button({ label: 'Cancelar', variant: 'ghost', onClick: close }),
        button({ label: 'Salvar', variant: 'primary', onClick: () => {
          item.efetivo = ef.getValue();
          chip.textContent = rotuloEquipe(item);
          chip.title = formatEfetivo(item.efetivo);
          aoMudar();
          close();
        } })
      ],
      onClose: close
    });
    document.body.appendChild(backdrop);
  }

  const rotuloEquipe = (item) => {
    const n = efetivoTotal(item.efetivo);
    return n ? `${n} pessoa${n > 1 ? 's' : ''}` : 'definir equipe';
  };

  function classes(item) {
    const wrap = el('div', { class: 'atv-classes' });
    const pintarClasses = () => mount(wrap, CLASSES[tipo].map(([valor, rotulo, dica]) =>
      el('button', { type: 'button', class: `atv-class atv-${valor}${item.classificacao === valor ? ' on' : ''}`, title: dica, onclick: () => {
        item.classificacao = valor;
        pintarClasses();
        aoMudar();
      } }, rotulo)
    ));
    pintarClasses();
    return wrap;
  }

  function cartao(item, idx) {
    const nome = el('input', { class: 'input', type: 'text', value: item.nome, placeholder: produtiva ? 'Ex.: Assentamento de tijolos' : 'Ex.: Aguardando liberação de APR', oninput: (e) => { item.nome = e.target.value; aoMudar(); } });
    const linhaProdutiva = produtiva
      ? el('div', { class: 'atv-linha' }, [
          el('label', { class: 'atv-campo' }, [
            el('span', {}, 'Tempo padrão'),
            el('span', { class: 'atv-min' }, [
              el('input', { class: 'input mono input-compact', type: 'number', min: '0', step: '5', value: String(item.duracaoMin || 0), oninput: (e) => { item.duracaoMin = Math.max(0, Math.round(Number(e.target.value) || 0)); aoMudar(); } }),
              'min'
            ])
          ]),
          el('label', { class: 'atv-campo' }, [
            el('span', {}, 'Colaboradores'),
            (() => {
              const chip = el('button', { type: 'button', class: 'chip', title: formatEfetivo(item.efetivo), onclick: () => editarEquipe(item, chip) }, rotuloEquipe(item));
              return chip;
            })()
          ])
        ])
      : null;
    return el('div', { class: 'atv-card' }, [
      el('div', { class: 'atv-topo' }, [
        el('span', { class: 'atv-num mono' }, String(idx + 1)),
        nome,
        produtiva ? button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.arrowUp(14), disabled: idx === 0, onClick: () => mover(idx, -1) }) : null,
        produtiva ? button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.arrowDown(14), disabled: idx === lista.length - 1, onClick: () => mover(idx, 1) }) : null,
        button({ iconOnly: true, size: 'sm', variant: 'ghost', icon: icon.trash(14), onClick: () => { lista.splice(idx, 1); pintar(); aoMudar(); } })
      ]),
      classes(item),
      linhaProdutiva
    ]);
  }

  function mover(idx, dir) {
    const [item] = lista.splice(idx, 1);
    lista.splice(idx + dir, 0, item);
    pintar();
    aoMudar();
  }

  function pintar() {
    const sugestoes = produtiva
      ? null
      : el('div', { class: 'atv-sugestoes' }, [
          el('span', { class: 'muted' }, 'Toque para incluir:'),
          ...SUGESTOES_IMPROD.filter(([n]) => !lista.some((i) => i.nome.toLowerCase() === n.toLowerCase())).map(([n, c]) =>
            el('button', { type: 'button', class: 'chip', onclick: () => adicionar([{ nome: n, classificacao: c }]) }, [el('span', { html: icon.plus(12) }), n])
          )
        ]);
    mount(corpo, [
      lista.length
        ? lista.map(cartao)
        : el('div', { class: 'atv-vazio' }, produtiva ? 'Nenhuma atividade ainda. Adicione uma a uma, use um modelo ou copie de outro projeto.' : 'Nenhuma improdutividade prevista. Use as sugestões abaixo ou adicione.'),
      sugestoes
    ]);
  }

  pintar();
  return { node, itens: () => lista };
}

/** Confere a lista antes de salvar; devolve a mensagem do problema ou null. */
export function validarAtividades(itens, tipo) {
  const vazio = itens.findIndex((i) => !i.nome.trim());
  if (vazio >= 0) return `A ${tipo === 'produtiva' ? 'atividade' : 'improdutividade'} nº ${vazio + 1} está sem nome.`;
  const vistos = new Set();
  for (const i of itens) {
    const k = i.nome.trim().toLowerCase();
    if (vistos.has(k)) return `"${i.nome}" aparece duas vezes.`;
    vistos.add(k);
  }
  return null;
}
