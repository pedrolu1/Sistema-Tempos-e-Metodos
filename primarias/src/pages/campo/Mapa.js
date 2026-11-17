// Mapa no celular: um bloco por vez, igual à planilha de Gestão Visual,
// com toque no forno para abrir a tela dele (lançar e tirar as fotos).
import { el } from '../../../../src/utils/dom.js';
import { legendaEtapas } from '../../components/base.js';
import { mapaBloco } from '../../components/mapa.js';
import { abrirTelaForno } from '../../components/telaForno.js';
import { blocosDa, contratoAtivo, FORNOS_POR_BLOCO } from '../../data/obra.js';
import { avancoFisico, idxsDoBloco } from '../../lib/calculo.js';

let blocoEscolhido = null;

export function paginaMapa({ calc, perfil, mudou, redesenhar }) {
  const bat = contratoAtivo().bateria;
  const blocos = blocosDa(bat);
  // começa no bloco onde o serviço está andando
  if (!blocoEscolhido || !blocos.includes(blocoEscolhido)) blocoEscolhido = blocos.find((bl) => !calc.blocos[bl].concluidoEm) || blocos[0];
  const b = calc.blocos[blocoEscolhido];
  const av = avancoFisico(calc, idxsDoBloco(blocoEscolhido));
  const abrir = (fid) => abrirTelaForno(fid, { perfil });

  const trilho = el('div', { class: 'blocos-trilho', role: 'tablist', 'aria-label': 'Blocos' }, blocos.map((bl) => el('button', {
    type: 'button', role: 'tab', 'aria-selected': String(bl === blocoEscolhido), class: `bloco-op${bl === blocoEscolhido ? ' ativo' : ''}`,
    onclick: () => {
      blocoEscolhido = bl;
      redesenhar();
    }
  }, [bl, el('i', {}, el('b', { style: { width: `${(calc.blocos[bl].concluidos / FORNOS_POR_BLOCO) * 100}%` } })), el('small', {}, calc.blocos[bl].concluidoEm ? 'concluído' : `${calc.blocos[bl].concluidos}/18`)])));

  return [
    el('div', { class: 'entre' }, [el('h2', { style: { fontSize: '28px' } }, `Bateria ${bat}`), el('span', { class: 'fraco', style: { fontSize: '13.5px' } }, 'Toque no forno para detalhes')]),
    trilho,
    el('div', { class: 'entre' }, [
      el('div', { class: 'titulo-secao' }, [`Bloco ${blocoEscolhido}`]),
      el('span', { class: 'fraco', style: { fontSize: '13.5px' } }, b.concluidoEm ? 'Bloco concluído' : `${b.concluidos} de 18 fornos · ${Math.round(av * 100)}% físico`)
    ]),
    legendaEtapas(),
    mapaBloco(calc, blocoEscolhido, { aoClicarForno: abrir, mudou })
  ];
}
