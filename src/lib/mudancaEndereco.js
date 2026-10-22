import { syncNow } from './sync.js';

/**
 * O app saiu do GitHub Pages e passou a morar só na Netlify. Quem abrir o
 * endereço antigo (inclusive o app instalado por ele) primeiro envia o que
 * estava pendente no aparelho e depois é levado ao endereço novo, junto com
 * os lançamentos "em andamento" e os rascunhos, que ficam guardados só no
 * navegador e não passariam sozinhos de um endereço para o outro.
 */
export const ENDERECO_NOVO = 'https://reframax-tempos-e-metodos.netlify.app/';
const ORIGEM_ANTIGA = 'https://pedrolu1.github.io';
const CHAVES = /^rfx\.(abertos|rascunho)\./;
const PREFIXO = '#trazer=';

export const noEnderecoAntigo = location.hostname.endsWith('github.io');

/** Envia as gravações pendentes (no máximo 20 s) e abre o endereço novo. */
export async function irParaEnderecoNovo({ comSessao }) {
  if (comSessao) await Promise.race([syncNow(), new Promise((r) => setTimeout(r, 20000))]).catch(() => {});
  const levar = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (CHAVES.test(k)) levar[k] = localStorage.getItem(k);
    }
  } catch {
    /* sem armazenamento: não há o que levar */
  }
  const hash = Object.keys(levar).length ? PREFIXO + encodeURIComponent(JSON.stringify(levar)) : '';
  location.replace(ENDERECO_NOVO + hash);
}

/**
 * No endereço novo: guarda o que veio do antigo. Só aceita quando a página
 * anterior é mesmo o endereço antigo, para um link de fora não conseguir
 * plantar dados no aparelho. Precisa rodar antes do roteador ler o "#".
 */
export function receberDoEnderecoAntigo() {
  if (!location.hash.startsWith(PREFIXO)) return;
  const dados = location.hash.slice(PREFIXO.length);
  history.replaceState(null, '', location.pathname + location.search);
  if (!document.referrer.startsWith(`${ORIGEM_ANTIGA}/`)) return;
  try {
    Object.entries(JSON.parse(decodeURIComponent(dados))).forEach(([k, v]) => {
      if (!CHAVES.test(k) || typeof v !== 'string') return;
      if (k.startsWith('rfx.abertos.')) {
        const atuais = JSON.parse(localStorage.getItem(k) || '[]');
        const ids = new Set(atuais.map((a) => a.id));
        localStorage.setItem(k, JSON.stringify([...atuais, ...JSON.parse(v).filter((a) => a && !ids.has(a.id))]));
      } else if (localStorage.getItem(k) === null) {
        localStorage.setItem(k, v);
      }
    });
  } catch {
    /* dado inválido ou sem armazenamento: segue sem importar */
  }
}
