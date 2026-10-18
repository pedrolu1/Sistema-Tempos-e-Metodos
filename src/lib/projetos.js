import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase.js';
import { EFETIVO_CAMPOS, escalaInfo } from '../utils/format.js';
import { reportSnapshotError } from './errors.js';

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

function sanitizeEfetivo(efetivo = {}) {
  const out = {};
  EFETIVO_CAMPOS.forEach((c) => {
    out[c.key] = Math.max(0, Math.round(Number(efetivo[c.key]) || 0));
  });
  return out;
}

function subscribeCol(col, label, callback) {
  const q = query(collection(db, col), orderBy('nome', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), reportSnapshotError(label));
}

// ---------------- clientes ----------------
export const subscribeClientes = (cb) => subscribeCol('clientes', 'clientes', cb);

export function addCliente({ nome, unidade = '', criadoPor }) {
  return addDoc(collection(db, 'clientes'), { nome: nome.trim(), unidade: unidade.trim(), ativo: true, criadoPor, criadoEm: serverTimestamp() });
}
export const updateCliente = (id, data) => updateDoc(doc(db, 'clientes', id), data);
export const deleteCliente = (id) => deleteDoc(doc(db, 'clientes', id));

// ---------------- contratos ----------------
export const subscribeContratos = (cb) => subscribeCol('contratos', 'contratos', cb);

export function addContrato({ nome, numero = '', clienteId, clienteNome, criadoPor }) {
  return addDoc(collection(db, 'contratos'), {
    nome: nome.trim(),
    numero: numero.trim(),
    clienteId,
    clienteNome,
    ativo: true,
    criadoPor,
    criadoEm: serverTimestamp()
  });
}
export const updateContrato = (id, data) => updateDoc(doc(db, 'contratos', id), data);
export const deleteContrato = (id) => deleteDoc(doc(db, 'contratos', id));

// ---------------- projetos ----------------
export const subscribeProjetos = (cb) => subscribeCol('projetos', 'projetos', cb);

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
    id: e.id || `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    atividadeId: e.atividadeId || '',
    codigo: (e.codigo || '').trim(),
    nome: (e.nome || '').trim(),
    classificacao: e.classificacao === 'VA' ? 'VA' : 'DN',
    duracaoMin: Math.max(0, Math.round(Number(e.duracaoMin) || 0)),
    efetivo: sanitizeEfetivo(e.efetivo)
  };
}

export function addProjeto({ nome, contrato, cliente, setor = '', dataInicio = '', dataFim = '', ficha, etapas = [], criadoPor }) {
  return addDoc(collection(db, 'projetos'), {
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
    criadoPor,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  });
}

export function updateProjeto(id, data) {
  const patch = { ...data, atualizadoEm: serverTimestamp() };
  if (data.ficha) patch.ficha = sanitizeFicha(data.ficha);
  if (data.etapas) patch.etapas = data.etapas.map(sanitizeEtapa);
  return updateDoc(doc(db, 'projetos', id), patch);
}

export const deleteProjeto = (id) => deleteDoc(doc(db, 'projetos', id));

/** Projetos que o apontador pode escolher em campo (não concluídos). */
export function projetosAtivos(projetos) {
  return projetos.filter((p) => p.status !== 'concluido');
}
