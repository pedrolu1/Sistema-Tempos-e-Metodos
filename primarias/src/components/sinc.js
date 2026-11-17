// Chip que mostra se o que foi lançado já subiu para o banco: sem internet
// (fica guardado no aparelho), enviando ou em dia.
import { el } from '../../../src/utils/dom.js';
import { ic } from '../lib/icones.js';

export function chipSinc() {
  const no = el('span', { class: 'sinc-chip', role: 'status' });
  const atualizar = (estado) => {
    const n = estado.pendentes || 0;
    const [classe, icone, texto, titulo] = !estado.online
      ? ['offline', ic.semNuvem(15), n ? `Sem internet · ${n}` : 'Sem internet', 'Pode continuar lançando: fica guardado no aparelho e sobe sozinho quando a internet voltar.']
      : n
        ? ['enviando', ic.nuvem(15), `Enviando ${n}`, 'Enviando o que foi lançado sem internet.']
        : ['ok', ic.nuvem(15), 'Em dia', 'Tudo enviado para o banco.'];
    no.className = `sinc-chip ${classe}`;
    no.title = titulo;
    no.replaceChildren(el('span', { html: icone, style: { display: 'inline-flex' } }), texto);
  };
  return { no, atualizar };
}
