// Banco online (Firestore), em tempo real. Toda gravação vale na hora no
// aparelho: sem internet, fica na fila do próprio Firestore (guardada no
// aparelho) e sobe sozinha quando a rede volta. As coleções começam com
// "prim_" e as regras de segurança estão em firestore.rules.
import {
  collection, doc, setDoc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp, writeBatch, runTransaction, getDocs
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { primariasDoAlvo } from '../../data/obra.js';
import { somarDias, hoje } from '../datas.js';
import { toast } from '../../../../src/lib/toast.js';

export const backend = 'firestore';
const ouvintes = new Set();
let estado = {
  versao: 1, lancamentos: [], correcoes: [], rdos: {}, checklists: {}, ocorrencias: [], desvios: {}, config: {}, base: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine, pendentes: 0, carregado: false
};
const carregou = { lancamentos: false, config: false };
const pendentesPor = { lancamentos: 0, ocorrencias: 0, checklists: 0 };

function mudar(parcial) {
  estado = { ...estado, ...parcial, versao: estado.versao + 1 };
  estado.pendentes = pendentesPor.lancamentos + pendentesPor.ocorrencias + pendentesPor.checklists;
  estado.carregado = carregou.lancamentos && carregou.config;
  ouvintes.forEach((cb) => cb(estado));
}

// Um erro que chega depois (ex.: regra de segurança recusou) é avisado; a
// gravação em si não espera o servidor, para funcionar sem internet.
function semEsperar(promessa, oQue) {
  promessa.catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`[Firestore] ${oQue}`, err);
    toast(err?.code === 'permission-denied' ? `Sem permissão para ${oQue}.` : `Não foi possível salvar ${oQue}. Confira a internet.`, 'error', 6000);
  });
}
const erroLeitura = (oQue) => (err) => {
  // eslint-disable-next-line no-console
  console.error(`[Firestore] ${oQue}`, err);
  if (err?.code === 'permission-denied') toast(`Sem permissão para ver ${oQue}. As regras do Firestore do Primárias foram publicadas?`, 'error', 8000);
};

let iniciado = false;
function iniciar() {
  if (iniciado) return;
  iniciado = true;
  const meta = { includeMetadataChanges: true };
  onSnapshot(query(collection(db, 'prim_lancamentos'), orderBy('criadoEmLocal')), meta, (snap) => {
    carregou.lancamentos = true;
    pendentesPor.lancamentos = snap.docs.filter((d) => d.metadata.hasPendingWrites).length;
    mudar({ lancamentos: snap.docs.map((d) => ({ id: d.id, ...d.data(), _pendente: d.metadata.hasPendingWrites })) });
  }, erroLeitura('os lançamentos'));
  onSnapshot(collection(db, 'prim_correcoes'), (snap) => mudar({ correcoes: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }), erroLeitura('os pedidos de correção'));
  onSnapshot(query(collection(db, 'prim_ocorrencias'), where('data', '>=', somarDias(hoje(), -120))), meta, (snap) => {
    pendentesPor.ocorrencias = snap.docs.filter((d) => d.metadata.hasPendingWrites).length;
    mudar({ ocorrencias: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  }, erroLeitura('os registros do dia'));
  onSnapshot(collection(db, 'prim_checklists'), meta, (snap) => {
    pendentesPor.checklists = snap.docs.filter((d) => d.metadata.hasPendingWrites).length;
    mudar({ checklists: Object.fromEntries(snap.docs.map((d) => [d.id, d.data()])) });
  }, erroLeitura('os checklists'));
  onSnapshot(collection(db, 'prim_rdos'), (snap) => mudar({ rdos: Object.fromEntries(snap.docs.map((d) => [d.id, d.data()])) }), erroLeitura('os RDOs'));
  // desvio apagado fica como { ativo: false } (o planejador não apaga documentos)
  onSnapshot(collection(db, 'prim_desvios'), (snap) => mudar({ desvios: Object.fromEntries(snap.docs.filter((d) => d.data().ativo !== false).map((d) => [d.id, d.data()])) }), erroLeitura('os desvios'));
  onSnapshot(doc(db, 'prim_config', 'geral'), (snap) => {
    carregou.config = true;
    mudar({ config: snap.exists() ? snap.data() : {} });
  }, (err) => {
    carregou.config = true;
    erroLeitura('a configuração')(err);
    mudar({});
  });
  onSnapshot(doc(db, 'prim_config', 'base'), (snap) => mudar({ base: snap.exists() ? snap.data() : null }), erroLeitura('a base da planilha'));
  window.addEventListener('online', () => mudar({ online: true }));
  window.addEventListener('offline', () => mudar({ online: false }));
}

export function assinar(cb) {
  iniciar();
  ouvintes.add(cb);
  cb(estado);
  return () => ouvintes.delete(cb);
}
export const estadoAtual = () => estado;

// ---------------------------------------------------------------------------
// Lançamentos e correções
// ---------------------------------------------------------------------------
export function lancar({ etapa, alvos, data, obs = '', autor }) {
  const ref = doc(collection(db, 'prim_lancamentos'));
  const lanc = { etapa, alvos, prims: [...new Set(alvos.flatMap(primariasDoAlvo))], data, obs: obs.trim(), autor, criadoEmLocal: Date.now(), status: 'valido' };
  semEsperar(setDoc(ref, { ...lanc, criadoEm: serverTimestamp() }), 'o lançamento');
  return { id: ref.id, ...lanc };
}
export function cancelarLancamento(id, por, motivo = '') {
  semEsperar(updateDoc(doc(db, 'prim_lancamentos', id), { status: 'cancelado', canceladoPor: por, canceladoEm: serverTimestamp(), motivoCancelamento: motivo }), 'o cancelamento');
}
export function trocarDataLancamento(id, data, por) {
  semEsperar(updateDoc(doc(db, 'prim_lancamentos', id), { data, alteradoPor: por, alteradoEm: serverTimestamp() }), 'a troca do dia');
}
export function pedirCorrecao({ lancId, tipo, motivo, novaData = '', autor }) {
  const ref = doc(collection(db, 'prim_correcoes'));
  const c = { lancId, tipo, motivo: motivo.trim(), novaData, autor, criadoEmLocal: Date.now(), status: 'pendente' };
  semEsperar(setDoc(ref, { ...c, criadoEm: serverTimestamp() }), 'o pedido de correção');
  return { id: ref.id, ...c };
}
export function decidirCorrecao(id, aprovar, por, resposta = '') {
  const c = estado.correcoes.find((x) => x.id === id);
  if (!c || c.status !== 'pendente') return;
  const lote = writeBatch(db);
  lote.update(doc(db, 'prim_correcoes', id), { status: aprovar ? 'aprovada' : 'recusada', decididoPor: por, decididoEm: serverTimestamp(), resposta: resposta.trim() });
  if (aprovar && c.tipo === 'excluir') lote.update(doc(db, 'prim_lancamentos', c.lancId), { status: 'cancelado', canceladoPor: por, canceladoEm: serverTimestamp(), motivoCancelamento: c.motivo });
  if (aprovar && c.tipo === 'data' && c.novaData) lote.update(doc(db, 'prim_lancamentos', c.lancId), { data: c.novaData, alteradoPor: por, alteradoEm: serverTimestamp() });
  semEsperar(lote.commit(), 'a decisão');
}

// ---------------------------------------------------------------------------
// Registros do dia, RDO, desvios, configuração e base
// ---------------------------------------------------------------------------
export function registrarOcorrencia({ data, tipo, texto, autor }) {
  const ref = doc(collection(db, 'prim_ocorrencias'));
  const o = { data, tipo, texto: texto.trim(), autor, criadoEmLocal: Date.now(), status: 'valido' };
  semEsperar(setDoc(ref, { ...o, criadoEm: serverTimestamp() }), 'o registro');
  return { id: ref.id, ...o };
}
export function removerOcorrencia(id) {
  semEsperar(updateDoc(doc(db, 'prim_ocorrencias', id), { status: 'cancelado' }), 'a remoção do registro');
}
export function salvarRdo(data, mudancas) {
  semEsperar(setDoc(doc(db, 'prim_rdos', data), { status: estado.rdos[data]?.status || 'rascunho', ...mudancas, atualizadoEm: serverTimestamp() }, { merge: true }), 'o RDO');
}
export function salvarDesvio(data, desvio) {
  semEsperar(setDoc(doc(db, 'prim_desvios', data), desvio ? { ...desvio, ativo: true } : { ativo: false }), 'o desvio');
}
export function salvarConfig(mudancas) {
  semEsperar(setDoc(doc(db, 'prim_config', 'geral'), mudancas, { merge: true }), 'a configuração');
}
export function salvarBase(base) {
  return setDoc(doc(db, 'prim_config', 'base'), { ...base, atualizadoEm: serverTimestamp() });
}

// ---------------------------------------------------------------------------
// Checklist com fotos. Cada foto é um documento (imagem comprimida); o
// documento do checklist guarda só quais fotos já existem, para as listas
// não precisarem baixar as imagens.
// ---------------------------------------------------------------------------
export function assinarFotos(fornoId, cb) {
  return onSnapshot(query(collection(db, 'prim_fotos'), where('fornoId', '==', fornoId)), { includeMetadataChanges: true }, (snap) => {
    cb(Object.fromEntries(snap.docs.map((d) => [d.data().slot, { ...d.data(), pendente: d.metadata.hasPendingWrites }])));
  }, erroLeitura('as fotos'));
}
/** Fotos de um forno, uma vez (para gerar o PDF do checklist). */
export async function lerFotos(fornoId) {
  const snap = await getDocs(query(collection(db, 'prim_fotos'), where('fornoId', '==', fornoId)));
  return Object.fromEntries(snap.docs.map((d) => [d.data().slot, d.data()]));
}
export function salvarFoto({ fornoId, slot, imagem, largura, altura, autor }) {
  const lote = writeBatch(db);
  lote.set(doc(db, 'prim_fotos', `${fornoId}__${slot}`), { fornoId, slot, imagem, largura, altura, autor, tiradaEmLocal: Date.now(), tiradaEm: serverTimestamp() });
  lote.set(doc(db, 'prim_checklists', fornoId), { fotos: { [slot]: { em: Date.now(), autor: autor.nome } } }, { merge: true });
  const p = lote.commit();
  semEsperar(p, 'a foto');
  return Promise.resolve();
}
export function enviarChecklist(fornoId, autor, obs = '') {
  semEsperar(setDoc(doc(db, 'prim_checklists', fornoId), { status: 'enviado', obs, enviadoPor: autor.nome, enviadoPorUid: autor.uid, enviadoEm: serverTimestamp(), enviadoEmLocal: Date.now() }, { merge: true }), 'o checklist');
}
export function devolverChecklist(fornoId, por, motivo) {
  semEsperar(setDoc(doc(db, 'prim_checklists', fornoId), { status: 'devolvido', devolvidoPor: por, motivoDevolucao: motivo, devolvidoEm: serverTimestamp() }, { merge: true }), 'a devolução');
}
/** Aprova e numera na sequência da medição. Precisa de internet (o número não pode repetir). */
export function aprovarChecklist(fornoId, por, minimo) {
  const contador = doc(db, 'prim_config', 'contadores');
  const ck = doc(db, 'prim_checklists', fornoId);
  return runTransaction(db, async (t) => {
    const [c, atual] = [await t.get(contador), await t.get(ck)];
    if (atual.exists() && atual.data().status === 'aprovado') return atual.data().numero;
    const numero = Math.max(Number(c.exists() ? c.data().checklist : 0) || 0, minimo) + 1;
    t.set(contador, { checklist: numero }, { merge: true });
    t.set(ck, { status: 'aprovado', numero, aprovadoPor: por, aprovadoEm: serverTimestamp() }, { merge: true });
    return numero;
  });
}

export function restaurarDemo() {
  /* só existe no banco local */
}
