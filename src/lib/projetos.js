import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase.js';
import { sanitizeEfetivo, escalaInfo } from '../utils/format.js';
import { reportSnapshotError } from './errors.js';
import { gravacaoLocal } from './sync.js';
import { auditar, camposAlterados } from './auditoria.js';

/**
 * Estrutura de planejamento (estilo MS Project simplificado):
 *   clientes  → quem contrata (ex.: Ternium — Santa Cruz)
 *   contratos → frente de trabalho do cliente (ex.: Coqueria, Alto-Forno)
 *   projetos  → o serviço planejado dentro do contrato, com a ficha
 *               (escala, horários, equipes, MOD, restrições) e as etapas
 *               planejadas (duração + efetivo de cada uma).
 * As etapas ficam dentro do próprio documento do projeto: um único
 * documento chega inteiro no celular e funciona offline sem consultas extras.
 */


const novoId = (prefixo) => `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Cria um documento com id gerado no aparelho (não trava sem internet). */
async function criar(col, dados) {
  const ref = doc(collection(db, col));
  await gravacaoLocal(setDoc(ref, dados), col);
  return ref.id;
}

function subscribeCol(col, label, callback) {
  const q = query(collection(db, col), orderBy('nome', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), reportSnapshotError(label));
}

// ---------------- clientes ----------------
export const subscribeClientes = (cb) => subscribeCol('clientes', 'clientes', cb);

export function addCliente({ nome, unidade = '', criadoPor }) {
  return criar('clientes', { nome: nome.trim(), unidade: unidade.trim(), ativo: true, criadoPor, criadoEm: serverTimestamp() });
}
export function updateCliente(id, data) {
  auditar('alterou', 'cliente', id, camposAlterados(data));
  return gravacaoLocal(updateDoc(doc(db, 'clientes', id), data), 'cliente');
}
export function deleteCliente(id, nome = '') {
  auditar('excluiu', 'cliente', id, nome);
  return deleteDoc(doc(db, 'clientes', id));
}

// ---------------- contratos ----------------
export const subscribeContratos = (cb) => subscribeCol('contratos', 'contratos', cb);

export function addContrato({ nome, numero = '', clienteId, clienteNome, criadoPor }) {
  return criar('contratos', {
    nome: nome.trim(),
    numero: numero.trim(),
    clienteId,
    clienteNome,
    ativo: true,
    criadoPor,
    criadoEm: serverTimestamp()
  });
}
export function updateContrato(id, data) {
  auditar('alterou', 'contrato', id, camposAlterados(data));
  return gravacaoLocal(updateDoc(doc(db, 'contratos', id), data), 'contrato');
}
export function deleteContrato(id, nome = '') {
  auditar('excluiu', 'contrato', id, nome);
  return deleteDoc(doc(db, 'contratos', id));
}

// ---------------- projetos ----------------
/**
 * Projetos. Com `contratos` (permissão por contrato do apontador), a consulta
 * já vem filtrada — as regras do Firestore só liberam esses projetos para
 * ele. Sem ordenação no servidor para não exigir índice composto.
 */
export function subscribeProjetos(cb, contratos = []) {
  if (!contratos.length) return subscribeCol('projetos', 'projetos', cb);
  const q = query(collection(db, 'projetos'), where('contratoId', 'in', contratos.slice(0, 30)));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.nome.localeCompare(b.nome))), reportSnapshotError('projetos'));
}

export const STATUS_PROJETO = [
  { value: 'planejado', label: 'Planejado', tone: 'info' },
  { value: 'andamento', label: 'Em andamento', tone: 'ok' },
  { value: 'pausado', label: 'Pausado', tone: 'warn' },
  { value: 'concluido', label: 'Concluído', tone: 'neutral' }
];

/** Ficha padrão de um projeto novo — tudo editável pelo planejador. */
export function fichaPadrao(escala = 'adm') {
  return {
    escala,
    horasPorTurno: escalaInfo(escala).horasPadrao,
    horaChegada: '07:00',
    horaSaida: '17:00',
    almocoInicio: '11:00',
    almocoFim: '12:00',
    turmas: 1,
    efetivo: sanitizeEfetivo({}),
    restricoes: []
  };
}

function sanitizeFicha(f = {}) {
  const base = fichaPadrao(f.escala);
  return {
    escala: f.escala || base.escala,
    horasPorTurno: Math.max(1, Math.round(Number(f.horasPorTurno) || base.horasPorTurno)),
    horaChegada: f.horaChegada || base.horaChegada,
    horaSaida: f.horaSaida || base.horaSaida,
    almocoInicio: f.almocoInicio || '',
    almocoFim: f.almocoFim || '',
    turmas: Math.max(1, Math.round(Number(f.turmas) || 1)),
    efetivo: sanitizeEfetivo(f.efetivo),
    restricoes: (f.restricoes || []).map((r) => String(r).trim()).filter(Boolean)
  };
}

export function sanitizeEtapa(e = {}) {
  return {
    id: e.id || novoId('e'),
    atividadeId: e.atividadeId || '',
    codigo: (e.codigo || '').trim(),
    nome: (e.nome || '').trim(),
    classificacao: e.classificacao === 'VA' ? 'VA' : 'DN',
    duracaoMin: Math.max(0, Math.round(Number(e.duracaoMin) || 0)),
    efetivo: sanitizeEfetivo(e.efetivo)
  };
}

/** Improdutividade prevista no projeto: DN (inevitável) ou DNN (evitável). */
export function sanitizeImprodutividade(i = {}) {
  return {
    id: i.id || novoId('i'),
    atividadeId: i.atividadeId || '',
    nome: (i.nome || '').trim(),
    classificacao: i.classificacao === 'DN' ? 'DN' : 'DNN'
  };
}

/** Cria o projeto e devolve o id na hora (gerado no aparelho). */
export async function addProjeto({ nome, contrato, cliente, setor = '', dataInicio = '', dataFim = '', ficha, etapas = [], improdutividades = [], criadoPor }) {
  const ref = doc(collection(db, 'projetos'));
  await gravacaoLocal(setDoc(ref, {
    nome: nome.trim(),
    contratoId: contrato.id,
    contratoNome: contrato.nome,
    clienteId: cliente?.id || contrato.clienteId || '',
    clienteNome: cliente?.nome || contrato.clienteNome || '',
    setor,
    dataInicio,
    dataFim,
    status: 'planejado',
    ficha: sanitizeFicha(ficha),
    etapas: etapas.map(sanitizeEtapa),
    improdutividades: improdutividades.map(sanitizeImprodutividade),
    criadoPor,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  }), 'projeto');
  return ref.id;
}

export function updateProjeto(id, data) {
  auditar('alterou', 'projeto', id, camposAlterados(data));
  const patch = { ...data, atualizadoEm: serverTimestamp() };
  if (data.ficha) patch.ficha = sanitizeFicha(data.ficha);
  if (data.etapas) patch.etapas = data.etapas.map(sanitizeEtapa);
  if (data.improdutividades) patch.improdutividades = data.improdutividades.map(sanitizeImprodutividade);
  return gravacaoLocal(updateDoc(doc(db, 'projetos', id), patch), 'projeto');
}

export function deleteProjeto(id, nome = '') {
  auditar('excluiu', 'projeto', id, nome);
  return deleteDoc(doc(db, 'projetos', id));
}

/** Projetos que o apontador pode escolher em campo (não concluídos). */
export function projetosAtivos(projetos) {
  return projetos.filter((p) => p.status !== 'concluido');
}
