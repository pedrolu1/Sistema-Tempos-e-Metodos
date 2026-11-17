// Banco local, para desenvolver e testar sem Firebase: os dados ficam no
// navegador e passam de uma aba para outra na hora (abra o líder numa aba e
// o planejador em outra). Mesmas funções do banco do Firestore.
import { SEED_DESVIOS } from '../../data/seed.js';
import { primariasDoAlvo, SLOTS_FOTO } from '../../data/obra.js';

const CHAVE = 'prim.demo.v2';
const CHAVE_FOTO = 'prim.demo.foto.';
const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('prim-demo') : null;
const ouvintes = new Set();
const ouvintesFotos = new Map(); // fornoId -> Set(cb)
const fotosNaMemoria = new Map(); // quando o navegador não guarda mais (cota cheia)

const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function estadoInicial() {
  return {
    versao: 1,
    lancamentos: [],
    correcoes: [],
    rdos: {},
    checklists: {},
    ocorrencias: [],
    desvios: Object.fromEntries(SEED_DESVIOS.map((d) => [d.data, { empresa: d.empresa, motivo: d.motivo, obs: d.obs, origem: 'planilha' }])),
    config: {},
    base: null,
    contadores: {}
  };
}

function ler() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return { ...estadoInicial(), ...JSON.parse(bruto), online: true, pendentes: 0 };
  } catch {
    /* armazenamento bloqueado ou corrompido: começa do zero */
  }
  return { ...estadoInicial(), online: true, pendentes: 0 };
}

let estado = ler();

function gravar(mudar) {
  estado = { ...estado, ...mudar(estado), versao: estado.versao + 1 };
  try {
    const { online, pendentes, ...guardar } = estado;
    localStorage.setItem(CHAVE, JSON.stringify(guardar));
  } catch {
    /* sem armazenamento: vale enquanto a aba estiver aberta */
  }
  canal?.postMessage({ tipo: 'estado' });
  avisar();
}
const avisar = () => ouvintes.forEach((cb) => cb(estado));

canal?.addEventListener('message', (e) => {
  if (e.data?.tipo === 'foto') return avisarFotos(e.data.fornoId);
  estado = ler();
  avisar();
});

export const backend = 'local';
export function assinar(cb) {
  ouvintes.add(cb);
  cb(estado);
  return () => ouvintes.delete(cb);
}
export const estadoAtual = () => estado;

// ---------------------------------------------------------------------------
// Lançamentos e correções
// ---------------------------------------------------------------------------
export function lancar({ etapa, alvos, data, obs = '', autor }) {
  const lanc = { id: novoId(), etapa, alvos, prims: [...new Set(alvos.flatMap(primariasDoAlvo))], data, obs: obs.trim(), autor, criadoEmLocal: Date.now(), status: 'valido' };
  gravar((e) => ({ lancamentos: [...e.lancamentos, lanc] }));
  return lanc;
}
export function cancelarLancamento(id, por, motivo = '') {
  gravar((e) => ({ lancamentos: e.lancamentos.map((l) => (l.id === id ? { ...l, status: 'cancelado', canceladoPor: por, canceladoEmLocal: Date.now(), motivoCancelamento: motivo } : l)) }));
}
export function trocarDataLancamento(id, data, por) {
  gravar((e) => ({ lancamentos: e.lancamentos.map((l) => (l.id === id ? { ...l, data, alteradoPor: por, alteradoEmLocal: Date.now() } : l)) }));
}
export function pedirCorrecao({ lancId, tipo, motivo, novaData = '', autor }) {
  const c = { id: novoId(), lancId, tipo, motivo: motivo.trim(), novaData, autor, criadoEmLocal: Date.now(), status: 'pendente' };
  gravar((e) => ({ correcoes: [...e.correcoes, c] }));
  return c;
}
export function decidirCorrecao(id, aprovar, por, resposta = '') {
  const c = estado.correcoes.find((x) => x.id === id);
  if (!c || c.status !== 'pendente') return;
  gravar((e) => ({ correcoes: e.correcoes.map((x) => (x.id === id ? { ...x, status: aprovar ? 'aprovada' : 'recusada', decididoPor: por, decididoEmLocal: Date.now(), resposta: resposta.trim() } : x)) }));
  if (aprovar && c.tipo === 'excluir') cancelarLancamento(c.lancId, por, c.motivo);
  if (aprovar && c.tipo === 'data' && c.novaData) trocarDataLancamento(c.lancId, c.novaData, por);
}

// ---------------------------------------------------------------------------
// Registros do dia (5S, ocorrências), RDO, desvios, configuração e base
// ---------------------------------------------------------------------------
export function registrarOcorrencia({ data, tipo, texto, autor }) {
  const o = { id: novoId(), data, tipo, texto: texto.trim(), autor, criadoEmLocal: Date.now(), status: 'valido' };
  gravar((e) => ({ ocorrencias: [...e.ocorrencias, o] }));
  return o;
}
export function removerOcorrencia(id) {
  gravar((e) => ({ ocorrencias: e.ocorrencias.map((o) => (o.id === id ? { ...o, status: 'cancelado' } : o)) }));
}
export function salvarRdo(data, mudancas) {
  gravar((e) => ({ rdos: { ...e.rdos, [data]: { ...(e.rdos[data] || { status: 'rascunho' }), ...mudancas } } }));
}
export function salvarDesvio(data, desvio) {
  gravar((e) => {
    const desvios = { ...e.desvios };
    if (desvio) desvios[data] = desvio;
    else delete desvios[data];
    return { desvios };
  });
}
export function salvarConfig(mudancas) {
  gravar((e) => ({ config: { ...e.config, ...mudancas } }));
}
export function salvarBase(base) {
  gravar(() => ({ base }));
  return Promise.resolve();
}
export function restaurarDemo() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith(CHAVE_FOTO)) localStorage.removeItem(k);
  }
  fotosNaMemoria.clear();
  estado = { ...estadoInicial(), versao: estado.versao + 1, online: true, pendentes: 0 };
  gravar(() => ({}));
}

// ---------------------------------------------------------------------------
// Checklist com fotos
// ---------------------------------------------------------------------------
function lerFoto(fornoId, slot) {
  const chave = `${CHAVE_FOTO}${fornoId}__${slot}`;
  if (fotosNaMemoria.has(chave)) return fotosNaMemoria.get(chave);
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}
function avisarFotos(fornoId) {
  const lista = ouvintesFotos.get(fornoId);
  if (!lista) return;
  const fotos = {};
  for (const s of SLOTS_FOTO) {
    const f = lerFoto(fornoId, s.id);
    if (f) fotos[s.id] = { ...f, pendente: false };
  }
  lista.forEach((cb) => cb(fotos));
}
export function lerFotos(fornoId) {
  const fotos = {};
  for (const s of SLOTS_FOTO) {
    const f = lerFoto(fornoId, s.id);
    if (f) fotos[s.id] = f;
  }
  return Promise.resolve(fotos);
}
export function assinarFotos(fornoId, cb) {
  if (!ouvintesFotos.has(fornoId)) ouvintesFotos.set(fornoId, new Set());
  ouvintesFotos.get(fornoId).add(cb);
  avisarFotos(fornoId);
  return () => ouvintesFotos.get(fornoId)?.delete(cb);
}
export function salvarFoto({ fornoId, slot, imagem, largura, altura, autor }) {
  const foto = { fornoId, slot, imagem, largura, altura, autor, tiradaEmLocal: Date.now() };
  const chave = `${CHAVE_FOTO}${fornoId}__${slot}`;
  try {
    localStorage.setItem(chave, JSON.stringify(foto));
    fotosNaMemoria.delete(chave);
  } catch {
    fotosNaMemoria.set(chave, foto);
  }
  gravar((e) => {
    const atual = e.checklists[fornoId] || {};
    return { checklists: { ...e.checklists, [fornoId]: { ...atual, fotos: { ...(atual.fotos || {}), [slot]: { em: Date.now(), autor: autor.nome } } } } };
  });
  canal?.postMessage({ tipo: 'foto', fornoId });
  avisarFotos(fornoId);
  return Promise.resolve();
}
export function enviarChecklist(fornoId, autor, obs = '') {
  gravar((e) => ({ checklists: { ...e.checklists, [fornoId]: { ...(e.checklists[fornoId] || {}), status: 'enviado', obs, enviadoPor: autor.nome, enviadoPorUid: autor.uid, enviadoEmLocal: Date.now() } } }));
}
export function devolverChecklist(fornoId, por, motivo) {
  gravar((e) => ({ checklists: { ...e.checklists, [fornoId]: { ...(e.checklists[fornoId] || {}), status: 'devolvido', devolvidoPor: por, motivoDevolucao: motivo } } }));
}
export function aprovarChecklist(fornoId, por, minimo) {
  const atual = estado.checklists[fornoId];
  if (atual?.status === 'aprovado') return Promise.resolve(atual.numero);
  const numero = Math.max(Number(estado.contadores.checklist) || 0, minimo) + 1;
  gravar((e) => ({
    contadores: { ...e.contadores, checklist: numero },
    checklists: { ...e.checklists, [fornoId]: { ...(e.checklists[fornoId] || {}), status: 'aprovado', numero, aprovadoPor: por, aprovadoEmLocal: Date.now() } }
  }));
  return Promise.resolve(numero);
}
