// Banco de dados do app. Nesta primeira etapa (só a interface) os dados ficam
// no navegador e passam de uma aba para outra na hora, para dar para testar o
// "tempo real" abrindo o campo numa aba e o painel em outra. Na etapa 2 este
// arquivo passa a falar com o Firestore, mantendo as mesmas funções.
import { SEED_DESVIOS } from '../data/seed.js';
import { CHECKLIST_MODELO, ETAPAS, primariasDoAlvo } from '../data/obra.js';

const CHAVE = 'prim.demo.v1';
const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('prim-demo') : null;
const ouvintes = new Set();

const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function estadoInicial() {
  return {
    versao: 1,
    lancamentos: [],
    correcoes: [],
    rdos: {},
    checklists: {},
    desvios: Object.fromEntries(SEED_DESVIOS.map((d) => [d.data, { empresa: d.empresa, motivo: d.motivo, obs: d.obs, origem: 'planilha' }])),
    config: {
      // pesos iguais até o planejador definir os oficiais
      pesos: Object.fromEntries(ETAPAS.map((e) => [e.id, 1])),
      pesosProvisorios: true,
      checklist: [...CHECKLIST_MODELO],
      replanejado: {}
    }
  };
}

function ler() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return { ...estadoInicial(), ...JSON.parse(bruto) };
  } catch {
    /* armazenamento bloqueado ou corrompido: começa do zero */
  }
  return estadoInicial();
}

let estado = ler();

function gravar() {
  estado = { ...estado, versao: estado.versao + 1 };
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    /* sem armazenamento: vale enquanto a aba estiver aberta */
  }
  canal?.postMessage({ versao: estado.versao });
  avisar();
}

function avisar() {
  ouvintes.forEach((cb) => cb(estado));
}

canal?.addEventListener('message', () => {
  estado = ler();
  avisar();
});
window.addEventListener('storage', (e) => {
  if (e.key !== CHAVE) return;
  estado = ler();
  avisar();
});

/** Recebe o estado agora e a cada mudança (inclusive vinda de outra aba). */
export function assinar(cb) {
  ouvintes.add(cb);
  cb(estado);
  return () => ouvintes.delete(cb);
}
export const estadoAtual = () => estado;

// ---------------------------------------------------------------------------
// Lançamentos: entram valendo na hora; quem é de campo não altera nem apaga,
// só pede correção ao planejador.
// ---------------------------------------------------------------------------
export function lancar({ etapa, alvos, data, obs = '', autor }) {
  const lanc = {
    id: novoId(),
    etapa,
    alvos,
    prims: [...new Set(alvos.flatMap(primariasDoAlvo))],
    data,
    obs: obs.trim(),
    autor,
    criadoEm: Date.now(),
    status: 'valido'
  };
  estado = { ...estado, lancamentos: [...estado.lancamentos, lanc] };
  gravar();
  return lanc;
}

export function cancelarLancamento(id, por, motivo = '') {
  estado = {
    ...estado,
    lancamentos: estado.lancamentos.map((l) => (l.id === id ? { ...l, status: 'cancelado', canceladoPor: por, canceladoEm: Date.now(), motivoCancelamento: motivo } : l))
  };
  gravar();
}

export function trocarDataLancamento(id, data, por) {
  estado = { ...estado, lancamentos: estado.lancamentos.map((l) => (l.id === id ? { ...l, data, alteradoPor: por, alteradoEm: Date.now() } : l)) };
  gravar();
}

export function pedirCorrecao({ lancId, tipo, motivo, novaData = '', autor }) {
  const c = { id: novoId(), lancId, tipo, motivo: motivo.trim(), novaData, autor, criadoEm: Date.now(), status: 'pendente' };
  estado = { ...estado, correcoes: [...estado.correcoes, c] };
  gravar();
  return c;
}

export function decidirCorrecao(id, aprovar, por, resposta = '') {
  const c = estado.correcoes.find((x) => x.id === id);
  if (!c || c.status !== 'pendente') return;
  estado = {
    ...estado,
    correcoes: estado.correcoes.map((x) => (x.id === id ? { ...x, status: aprovar ? 'aprovada' : 'recusada', decididoPor: por, decididoEm: Date.now(), resposta: resposta.trim() } : x))
  };
  if (aprovar && c.tipo === 'excluir') return cancelarLancamento(c.lancId, por, c.motivo);
  if (aprovar && c.tipo === 'data' && c.novaData) return trocarDataLancamento(c.lancId, c.novaData, por);
  gravar();
}

// ---------------------------------------------------------------------------
// RDO, checklist, desvios e configuração
// ---------------------------------------------------------------------------
export function salvarRdo(data, mudancas) {
  const atual = estado.rdos[data] || { status: 'rascunho' };
  if (atual.status !== 'rascunho' && !mudancas.status) return;
  estado = { ...estado, rdos: { ...estado.rdos, [data]: { ...atual, ...mudancas } } };
  gravar();
}

export function salvarChecklist(fornoId, mudancas) {
  const atual = estado.checklists[fornoId] || { itens: [], status: 'rascunho' };
  estado = { ...estado, checklists: { ...estado.checklists, [fornoId]: { ...atual, ...mudancas, atualizadoEm: Date.now() } } };
  gravar();
}

export function salvarDesvio(data, desvio) {
  const desvios = { ...estado.desvios };
  if (desvio) desvios[data] = desvio;
  else delete desvios[data];
  estado = { ...estado, desvios };
  gravar();
}

export function salvarConfig(mudancas) {
  estado = { ...estado, config: { ...estado.config, ...mudancas } };
  gravar();
}

/** Volta ao estado das planilhas (apaga o que foi lançado na demonstração). */
export function restaurarDemo() {
  estado = { ...estadoInicial(), versao: estado.versao };
  gravar();
}
