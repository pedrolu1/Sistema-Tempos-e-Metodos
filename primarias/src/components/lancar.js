// Fluxo de lançamento: etapa → onde → confirmar. Pensado para o celular, com
// botões grandes, o caminho mais curto já selecionado e a comemoração no fim.
import { el } from '../../../src/utils/dom.js';
import { abrirFolha, seis, etiquetaEtapa } from './base.js';
import { ic, iconeEtapa } from '../lib/icones.js';
import { ETAPAS, etapaPorId, FORNOS, blocosDa, contratoAtivo, fornoPorId, primariaPorId, primariasDoAlvo, NIVEL_NOME, noMeio } from '../data/obra.js';
import { calcular, alvosDoForno, resumoAlvos, statsPessoa, efeitosDoLancamento, XP_POR_PRIMARIA, XP_FORNO, XP_BLOCO } from '../lib/calculo.js';
import { estadoAtual, lancar } from '../lib/store.js';
import { hoje, somarDias, completa } from '../lib/datas.js';
import { faiscas, vibrar, tocar, xpFlutuante, comemorar, anunciarConquista } from '../lib/efeitos.js';
import { autorDe } from '../lib/sessao.js';

const liberadosNoForno = (calc, etapaId, fid) => alvosDoForno(calc, etapaId, fid).filter((a) => a.ok);
const primariasLiberadas = (calc, etapaId, fornos) => fornos.reduce((s, f) => s + liberadosNoForno(calc, etapaId, f.id).reduce((t, a) => t + primariasDoAlvo(a.id).length, 0), 0);

/** Deixa o bloco escolhido visível no trilho (ele pode estar fora da tela, à direita). */
export function mostrarBlocoAtivo(raiz) {
  const ativo = raiz.querySelector('.blocos-trilho .bloco-op.ativo');
  const trilho = ativo?.parentElement;
  if (trilho) trilho.scrollLeft = ativo.offsetLeft - trilho.clientWidth / 2 + ativo.offsetWidth / 2;
}

export function abrirLancamento({ perfil, etapa = null, fornoId = null }) {
  const bat = contratoAtivo().bateria;
  const fornosBat = FORNOS.filter((f) => f.bateria === bat);
  const st = { passo: etapa ? 2 : 1, etapa, bloco: fornoId ? fornoPorId[fornoId].bloco : null, sel: new Map(), data: hoje(), obs: '' };
  if (etapa && fornoId) {
    const lib = liberadosNoForno(calcular(estadoAtual()), etapa, fornoId).map((a) => a.id);
    if (lib.length) st.sel.set(fornoId, new Set(lib));
  }
  const folha = abrirFolha({ titulo: '', corpo: [], classe: 'folha-lancar' });
  let passoDesenhado = 0;

  function totalPrims() {
    return [...st.sel.values()].reduce((s, alvos) => s + [...alvos].reduce((t, a) => t + primariasDoAlvo(a).length, 0), 0);
  }
  const alvosEscolhidos = () => [...st.sel.values()].flatMap((s) => [...s]);
  const passos = () => el('div', { class: 'passos', 'aria-hidden': 'true' }, [1, 2, 3].map((n) => el('span', { class: n < st.passo ? 'feito' : n === st.passo ? 'atual' : '' })));
  desenhar();

  function desenhar() {
    const calc = calcular(estadoAtual());
    // trocou de passo: volta ao topo; redesenho do mesmo passo mantém a rolagem
    st.topo = passoDesenhado !== st.passo;
    passoDesenhado = st.passo;
    if (st.passo === 1) passoEtapa(calc);
    else if (st.passo === 2) passoOnde(calc);
    else passoConfirmar(calc);
  }

  // ---- 1. O que foi feito ----
  function passoEtapa(calc) {
    folha.montar({
      topo: st.topo,
      titulo: 'O que foi feito?',
      subtitulo: `Bateria ${bat} · ${completa(st.data)}`,
      corpo: [
        passos(),
        el('div', { class: 'etapa-grade' }, ETAPAS.map((e, i) => {
          const livres = primariasLiberadas(calc, e.id, fornosBat);
          return el('button', {
            type: 'button', class: `etapa-op cor-${e.id}`,
            onclick: () => {
              vibrar(8);
              st.etapa = e.id;
              st.sel.clear();
              st.bloco = melhorBloco(calc, e.id);
              st.passo = 2;
              desenhar();
            }
          }, [
            el('span', { class: 'ordem' }, String(i + 1)),
            el('span', { class: 'icone', html: iconeEtapa(e.id, 22) }),
            el('div', {}, [el('strong', {}, e.curto), el('small', {}, NIVEL_NOME[e.nivel])]),
            el('span', { class: 'pend' }, livres ? `${livres} primárias liberadas` : 'Nada liberado agora')
          ]);
        }))
      ]
    });
  }

  function melhorBloco(calc, etapaId) {
    const conta = blocosDa(bat).map((bl) => [bl, primariasLiberadas(calc, etapaId, fornosBat.filter((f) => f.bloco === bl))]);
    const comAlgo = conta.filter((c) => c[1] > 0);
    return (comAlgo[0] || conta[0])[0];
  }

  // ---- 2. Onde ----
  function passoOnde(calc) {
    const e = etapaPorId[st.etapa];
    if (!st.bloco) st.bloco = melhorBloco(calc, e.id);
    const fornosBloco = fornosBat.filter((f) => f.bloco === st.bloco);
    const n = totalPrims();
    folha.montar({
      topo: st.topo,
      titulo: e.curto,
      subtitulo: `Bloco ${st.bloco} · escolha ${e.nivel === 'forno' ? 'os fornos' : e.nivel === 'cabeceira' ? 'os fornos e os lados' : 'os fornos e as primárias'}`,
      corpo: [
        el('div', { class: 'entre' }, [passos(), el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { st.passo = 1; desenhar(); } }, 'Trocar etapa')]),
        el('div', { class: 'blocos-trilho', role: 'tablist', 'aria-label': 'Blocos' }, blocosDa(bat).map((bl) => {
          const fs = fornosBat.filter((f) => f.bloco === bl);
          const livres = primariasLiberadas(calc, e.id, fs);
          const feitos = calc.blocos[bl].concluidos;
          const qtdSel = fs.filter((f) => st.sel.has(f.id)).length;
          return el('button', { type: 'button', role: 'tab', 'aria-selected': String(bl === st.bloco), class: `bloco-op${bl === st.bloco ? ' ativo' : ''}`, onclick: () => { st.bloco = bl; desenhar(); } }, [
            bl,
            el('i', {}, el('b', { style: { width: `${(feitos / 18) * 100}%` } })),
            el('small', {}, qtdSel ? `${qtdSel} escolhido${qtdSel > 1 ? 's' : ''}` : livres ? `${livres} livres` : 'nada livre')
          ]);
        })),
        el('div', { class: 'fornos-grade' }, fornosBloco.map((f) => {
          const lib = liberadosNoForno(calc, e.id, f.id);
          const marcado = st.sel.has(f.id);
          const todos = alvosDoForno(calc, e.id, f.id);
          const motivo = lib.length ? '' : todos.every((a) => a.feito) ? 'feito' : todos[0]?.motivo || '';
          return el('button', {
            type: 'button', class: `forno-op${marcado ? ' sel' : ''}`, disabled: !lib.length, 'aria-pressed': String(marcado),
            onclick: () => {
              vibrar(8);
              if (marcado) st.sel.delete(f.id);
              else st.sel.set(f.id, new Set(lib.map((a) => a.id)));
              desenhar();
            }
          }, [el('strong', {}, `F${String(f.forno).padStart(2, '0')}`), seis(calc, f.id), motivo ? el('span', { class: 'motivo' }, motivo) : null]);
        })),
        ...[...st.sel.keys()].map((fid) => ajusteForno(calc, e, fid))
      ],
      pe: [el('button', { type: 'button', class: 'btn btn-brasa', disabled: !n, onclick: () => { st.passo = 3; desenhar(); } }, n ? `Continuar · ${n} primária${n > 1 ? 's' : ''}` : 'Escolha onde foi feito')]
    });
    mostrarBlocoAtivo(folha.caixa);
  }

  /** Ajuste fino do forno escolhido: quais primárias (ou lados) entram. */
  function ajusteForno(calc, e, fid) {
    const escolhidos = st.sel.get(fid);
    const alvos = alvosDoForno(calc, e.id, fid);
    const alternar = (id) => {
      vibrar(6);
      if (escolhidos.has(id)) escolhidos.delete(id);
      else escolhidos.add(id);
      if (!escolhidos.size) st.sel.delete(fid);
      desenhar();
    };
    const botao = (a, rotulo, extra = '') => el('button', {
      type: 'button', class: `prim-op cor-${e.id}${escolhidos.has(a.id) ? ' sel' : ''}${a.feito ? ' feita' : ''} ${extra}`,
      disabled: !a.ok, 'aria-pressed': String(escolhidos.has(a.id)), title: a.ok ? '' : a.motivo, onclick: () => alternar(a.id)
    }, rotulo);
    let conteudo;
    if (e.nivel === 'forno') conteudo = el('p', { class: 'fraco', style: { fontSize: '13.5px' } }, 'Vale para as 6 primárias do forno.');
    else if (e.nivel === 'cabeceira') conteudo = el('div', { class: 'lados' }, alvos.map((a) => el('div', { class: 'lado-caixa' }, [el('span', {}, a.id.endsWith('LM') ? 'Lado máquina' : 'Lado coque'), botao(a, a.id.slice(-2), 'cab-op')])));
    else conteudo = el('div', { class: 'lados' }, ['LM', 'LC'].map((lado) => el('div', { class: 'lado-caixa' }, [
      el('span', {}, lado === 'LM' ? 'Lado máquina' : 'Lado coque'),
      el('div', { class: 'prims-op' }, alvos.filter((a) => primariaPorId[a.id].lado === lado).map((a) => botao(a, `P0${primariaPorId[a.id].p}`)))
    ])));
    const bloqueadas = alvos.filter((a) => !a.ok && !a.feito);
    return el('div', { class: 'selecao-forno' }, [
      el('div', { class: 'selecao-forno-topo' }, [fid.replace('-', ' · '), el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { st.sel.delete(fid); desenhar(); } }, 'Tirar')]),
      conteudo,
      bloqueadas.length ? el('div', { class: 'bloqueado-nota' }, [el('span', { html: ic.lock(14) }), `${bloqueadas.map((a) => a.id.split('-').slice(2).join(' ')).join(', ')}: ${bloqueadas[0].motivo}`]) : null
    ]);
  }

  // ---- 3. Confirmar ----
  function passoConfirmar(calc) {
    const e = etapaPorId[st.etapa];
    const alvos = alvosEscolhidos();
    const prims = [...new Set(alvos.flatMap(primariasDoAlvo))];
    const n = prims.length;
    const fornos = st.sel.size;
    const xp = n * XP_POR_PRIMARIA;
    const botao = el('button', { type: 'button', class: 'btn btn-brasa', onclick: () => confirmar(botao) }, [el('span', { html: iconeEtapa(e.id, 22) }), `Lançar ${noMeio(e)}`]);
    folha.montar({
      topo: st.topo,
      titulo: 'Confere e lança',
      subtitulo: 'Depois de lançado, só o planejador altera',
      corpo: [
        el('div', { class: 'entre' }, [passos(), el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { st.passo = 2; desenhar(); } }, 'Voltar')]),
        el('div', { class: `resumo-lanc cor-${e.id}` }, [
          el('div', { class: 'entre' }, [etiquetaEtapa(e), el('span', { class: 'fraco', style: { fontSize: '13px' } }, `+${xp} XP`)]),
          el('div', {}, [el('span', { class: 'contagem' }, String(n)), el('span', { class: 'fraco' }, ` primária${n > 1 ? 's' : ''} em ${fornos} forno${fornos > 1 ? 's' : ''}`)]),
          el('ul', {}, resumoAlvos(prims, e.id).map((l) => el('li', {}, [el('span', { class: 'ponto' }), l])))
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'field-label', for: 'lanc-data' }, 'Dia em que foi feito'),
          el('input', { id: 'lanc-data', class: 'input', type: 'date', value: st.data, max: hoje(), min: somarDias(hoje(), -7), onchange: (ev) => { st.data = ev.target.value || hoje(); } })
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'field-label', for: 'lanc-obs' }, 'Observação (opcional)'),
          el('textarea', { id: 'lanc-obs', class: 'textarea', rows: 2, placeholder: 'Ex.: manilha trincada no P02, trocada', value: st.obs, oninput: (ev) => { st.obs = ev.target.value; } })
        ])
      ],
      pe: [botao]
    });
  }

  function confirmar(botao) {
    botao.disabled = true;
    const antes = calcular(estadoAtual());
    const statsAntes = statsPessoa(antes, perfil.uid);
    const lanc = lancar({ etapa: st.etapa, alvos: alvosEscolhidos(), data: st.data, obs: st.obs, autor: autorDe(perfil) });
    const depois = calcular(estadoAtual());
    const statsDepois = statsPessoa(depois, perfil.uid);
    const ef = efeitosDoLancamento(antes, depois, lanc);
    const e = etapaPorId[st.etapa];

    vibrar([18, 30, 26]);
    tocar('ok');
    faiscas(botao, { quantidade: 40 });
    xpFlutuante(botao, `+${lanc.prims.length * XP_POR_PRIMARIA + ef.fornos.length * XP_FORNO + ef.blocos.length * XP_BLOCO} XP`);
    setTimeout(() => {
      folha.fechar();
      if (ef.blocos.length) comemorar({ titulo: `Bloco ${ef.blocos.join(', ')} aceso!`, texto: 'Os 18 fornos do bloco estão concluídos.', grande: true });
      else if (ef.fornos.length) comemorar({ titulo: ef.fornos.length > 1 ? `${ef.fornos.length} fornos fechados!` : `Forno ${ef.fornos[0].replace('-', ' ')} fechado!`, texto: 'As 6 primárias com massa 1200. Checklist de entrega liberado.' });
      if (statsDepois.nivel > statsAntes.nivel) setTimeout(() => comemorar({ titulo: `Você chegou a ${statsDepois.graus} °C`, texto: statsDepois.nivel >= 12 ? 'Temperatura máxima. Brasa viva.' : `Próximo: ${statsDepois.graus + 100} °C`, icone: ic.chama(54), som: 'nivel' }), ef.fornos.length ? 2700 : 0);
      const novas = statsDepois.conquistas.filter((c, i) => c.ganha && !statsAntes.conquistas[i].ganha);
      novas.forEach((c, i) => setTimeout(() => anunciarConquista(c), 600 + i * 3300 + (ef.fornos.length ? 2600 : 0)));
      if (!ef.fornos.length && statsDepois.nivel === statsAntes.nivel) comemorarSimples(e, lanc.prims.length);
    }, 520);
  }

  function comemorarSimples(e, n) {
    const aviso = el('div', { class: 'conquista-aviso lancado-aviso', role: 'status' }, [
      el('span', { class: `conquista-selo`, style: { background: e.cor, color: '#fff' }, html: ic.check(22) }),
      el('div', {}, [el('small', { style: { color: 'var(--text-1)' } }, `${e.curto} lançada`), el('strong', {}, `${n} primária${n > 1 ? 's' : ''} no mapa`)])
    ]);
    document.body.appendChild(aviso);
    setTimeout(() => aviso.classList.add('saindo'), 2200);
    setTimeout(() => aviso.remove(), 2600);
  }
}
