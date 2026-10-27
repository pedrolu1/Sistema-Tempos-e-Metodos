// Perfil: a temperatura (nível) da pessoa, os números dela e as conquistas.
import { el } from '../../../../src/utils/dom.js';
import { CREDITO } from '../../../../src/components/ui.js';
import { anel } from '../../components/base.js';
import { ic } from '../../lib/icones.js';
import { NIVEL_MAX, XP_POR_PRIMARIA, XP_FORNO, XP_BLOCO } from '../../lib/calculo.js';
import { somLigado, alternarSom, tocar } from '../../lib/efeitos.js';
import { PAPEIS } from '../../data/obra.js';

export function paginaPerfil({ perfil, stats, trocarVisao }) {
  const som = somLigado();
  return [
    el('div', { class: 'perfil-topo' }, [
      anel({ fracao: stats.fracao, tamanho: 168, espessura: 14, chave: 'perfil-nivel', centro: [el('span', { class: 'graus' }, `${stats.graus}°`), el('small', {}, stats.nivel >= NIVEL_MAX ? 'máximo' : `${stats.xp} / ${stats.ate} XP`)] }),
      el('h2', {}, perfil.nome),
      el('span', { class: 'fraco' }, `${PAPEIS[perfil.papel].nome} · ${stats.xp} XP no total`)
    ]),
    el('div', { class: 'dia-numeros' }, [
      el('div', {}, [el('span', { class: 'num' }, String(stats.etapas)), el('small', {}, 'etapas lançadas')]),
      el('div', {}, [el('span', { class: 'num' }, String(stats.fornos)), el('small', {}, 'fornos fechados')]),
      el('div', {}, [el('span', { class: 'num' }, String(stats.sequencia)), el('small', {}, 'dias seguidos')])
    ]),
    el('section', { class: 'pilha' }, [
      el('div', { class: 'titulo-secao' }, ['Conquistas', el('small', {}, `${stats.conquistas.filter((c) => c.ganha).length} de ${stats.conquistas.length}`)]),
      el('div', { class: 'conquistas' }, stats.conquistas.map((c) => el('div', { class: `conquista${c.ganha ? ' ganha' : ''}` }, [el('span', { class: 'selo', html: c.ganha ? ic.medalha(22) : ic.lock(18) }), el('div', {}, [el('strong', {}, c.nome), el('small', {}, c.desc)])])))
    ]),
    el('section', { class: 'card card-pad pilha', style: { gap: '8px' } }, [
      el('strong', {}, 'Como esquentar'),
      el('p', { class: 'fraco', style: { fontSize: '13.5px', lineHeight: '1.55' } }, `Cada primária lançada numa etapa vale ${XP_POR_PRIMARIA} XP. Fechar um forno (a última massa 1200) vale mais ${XP_FORNO}, e fechar um bloco, mais ${XP_BLOCO}. A cada nível a temperatura sobe 100 °C, até 1200 °C. Lançar todo dia útil mantém a chama acesa.`)
    ]),
    el('div', { class: 'menu-list' }, [
      el('button', { class: 'menu-item', type: 'button', onclick: (ev) => { alternarSom(!som); if (!som) tocar('ok'); ev.currentTarget.closest('.campo-conteudo').replaceChildren(...paginaPerfil({ perfil, stats, trocarVisao })); } }, [
        el('span', { html: som ? ic.som(20) : ic.semSom(20) }),
        el('div', {}, [el('strong', {}, som ? 'Som ligado' : 'Som desligado'), el('small', {}, 'Um toque curto ao lançar e ao fechar forno.')])
      ]),
      trocarVisao ? el('button', { class: 'menu-item', type: 'button', onclick: () => trocarVisao('painel') }, [el('span', { html: ic.grid(20) }), el('div', {}, [el('strong', {}, 'Voltar ao painel'), el('small', {}, 'Você está vendo o app como o campo vê.')])]) : null,
      el('button', { class: 'menu-item', type: 'button', onclick: () => window.dispatchEvent(new CustomEvent('prim:sair')) }, [el('span', { html: ic.logout(20) }), el('div', {}, [el('strong', {}, 'Sair'), el('small', {}, 'Volta para a tela de entrada.')])])
    ]),
    el('div', { class: 'credito' }, CREDITO)
  ];
}
