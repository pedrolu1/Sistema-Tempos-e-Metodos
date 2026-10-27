// Linha do feed ao vivo: quem lançou o quê, onde e quando.
import { el } from '../../../src/utils/dom.js';
import { iconeEtapa } from '../lib/icones.js';
import { etapaPorId } from '../data/obra.js';
import { resumoAlvos } from '../lib/calculo.js';
import { haQuanto, curta, hoje } from '../lib/datas.js';

const vistos = new Set();
let primeiraVez = true;

export function feed(lancs, { vazio = null, limite = 10 } = {}) {
  const lista = lancs.slice(-limite).reverse();
  const itens = lista.map((l) => {
    const e = etapaPorId[l.etapa];
    const linhas = resumoAlvos(l.prims, l.etapa);
    const novo = !primeiraVez && !vistos.has(l.id);
    vistos.add(l.id);
    return el('div', { class: `feed-item cor-${e.id}${novo ? ' novo' : ''}` }, [
      el('span', { class: 'feed-icone', html: iconeEtapa(e.id, 18) }),
      el('div', { class: 'feed-texto' }, [
        el('strong', {}, `${l.autor?.nome || 'Alguém'} · ${e.curto}`),
        el('span', {}, `${linhas.slice(0, 2).join(', ')}${linhas.length > 2 ? ` e mais ${linhas.length - 2}` : ''}${l.data !== hoje() ? ` · dia ${curta(l.data)}` : ''}`)
      ]),
      el('span', { class: 'feed-quando' }, haQuanto(l.criadoEm))
    ]);
  });
  lancs.forEach((l) => vistos.add(l.id));
  primeiraVez = false;
  return itens.length ? el('div', { class: 'feed' }, itens) : vazio;
}
