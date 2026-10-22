import { collection, doc, updateDoc, writeBatch, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { sanitizeEfetivo } from '../utils/format.js';
import { reportSnapshotError } from './errors.js';
import { auditar, camposAlterados } from './auditoria.js';
import { gravacaoLocal } from './sync.js';

/**
 * Catálogo interno de atividades. O planejador não mexe nele diretamente:
 * as atividades nascem dentro dos projetos (Projetos → atividades do
 * projeto) e o app cadastra aqui sozinho. Ele existe para que a mesma
 * atividade em projetos diferentes seja somada junta nos indicadores e
 * para os lançamentos avulsos (sem projeto).
 */
const COL = 'atividades';
const chave = (nome) => String(nome || '').trim().toLowerCase();

export function subscribeAtividades(callback) {
  const q = query(collection(db, COL), orderBy('nome', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), reportSnapshotError('atividades'));
}

/** Documento de atividade no formato do catálogo (produtiva: VA/DN; improdutiva: DN/DNN). */
export function docAtividade({ nome, tipo, classificacao = '', contrato = '', codigo = '', duracaoPadraoMin = 0, efetivoPadrao = {}, criadoPor }) {
  const produtiva = tipo === 'produtiva';
  return {
    nome: String(nome).trim(),
    tipo,
    classificacao: produtiva ? (classificacao === 'VA' ? 'VA' : 'DN') : classificacao === 'DN' ? 'DN' : 'DNN',
    contrato: String(contrato || '').trim(),
    codigo: String(codigo || '').trim(),
    setor: '',
    local: '',
    duracaoPadraoMin: produtiva ? Math.max(0, Math.round(Number(duracaoPadraoMin) || 0)) : 0,
    efetivoPadrao: produtiva ? sanitizeEfetivo(efetivoPadrao) : sanitizeEfetivo({}),
    ativo: true,
    criadoPor,
    criadoEm: serverTimestamp()
  };
}

/**
 * Liga cada atividade do projeto a uma atividade do catálogo: reaproveita
 * pelo nome (mesmo tipo) ou cria uma nova, tudo numa gravação só.
 * Devolve os itens com `atividadeId` preenchido.
 */
export async function vincularAtividades(itens, tipo, catalogo, { contrato = '', criadoPor } = {}) {
  const porNome = new Map(catalogo.filter((a) => a.tipo === tipo).map((a) => [chave(a.nome), a.id]));
  const porId = new Map(catalogo.map((a) => [a.id, a]));
  const lote = writeBatch(db);
  let novas = 0;
  const saida = itens.map((it) => {
    // mantém o vínculo só se continua sendo a mesma atividade (renomear liga a outra)
    const atual = porId.get(it.atividadeId);
    if (atual && atual.tipo === tipo && chave(atual.nome) === chave(it.nome)) return it;
    const achada = porNome.get(chave(it.nome));
    if (achada) return { ...it, atividadeId: achada };
    const ref = doc(collection(db, COL));
    lote.set(ref, docAtividade({ nome: it.nome, tipo, classificacao: it.classificacao, contrato, codigo: it.codigo, duracaoPadraoMin: it.duracaoMin, efetivoPadrao: it.efetivo, criadoPor }));
    porNome.set(chave(it.nome), ref.id);
    novas++;
    return { ...it, atividadeId: ref.id };
  });
  if (novas) await gravacaoLocal(lote.commit(), 'atividade');
  return saida;
}

export function updateAtividade(id, data) {
  auditar('alterou', 'atividade', id, camposAlterados(data));
  return gravacaoLocal(updateDoc(doc(db, COL, id), data), 'atividade');
}
