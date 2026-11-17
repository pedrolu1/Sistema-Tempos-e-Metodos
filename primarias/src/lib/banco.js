// Ponto único de acesso ao banco: Firestore quando o Firebase está configurado
// (app publicado), banco local do navegador no desenvolvimento e nos testes.
import { firebaseConfigured } from './firebase.js';
import * as local from './banco/local.js';
import * as online from './banco/firestore.js';

const b = firebaseConfigured ? online : local;

export const backend = b.backend;
export const assinar = (cb) => b.assinar(cb);
export const estadoAtual = () => b.estadoAtual();
export const lancar = (dados) => b.lancar(dados);
export const cancelarLancamento = (id, por, motivo) => b.cancelarLancamento(id, por, motivo);
export const trocarDataLancamento = (id, data, por) => b.trocarDataLancamento(id, data, por);
export const pedirCorrecao = (dados) => b.pedirCorrecao(dados);
export const decidirCorrecao = (id, aprovar, por, resposta) => b.decidirCorrecao(id, aprovar, por, resposta);
export const registrarOcorrencia = (dados) => b.registrarOcorrencia(dados);
export const removerOcorrencia = (id) => b.removerOcorrencia(id);
export const salvarRdo = (data, mudancas) => b.salvarRdo(data, mudancas);
export const salvarDesvio = (data, desvio) => b.salvarDesvio(data, desvio);
export const salvarConfig = (mudancas) => b.salvarConfig(mudancas);
export const salvarBase = (base) => b.salvarBase(base);
export const assinarFotos = (fornoId, cb) => b.assinarFotos(fornoId, cb);
export const lerFotos = (fornoId) => b.lerFotos(fornoId);
export const salvarFoto = (dados) => b.salvarFoto(dados);
export const enviarChecklist = (fornoId, autor, obs) => b.enviarChecklist(fornoId, autor, obs);
export const devolverChecklist = (fornoId, por, motivo) => b.devolverChecklist(fornoId, por, motivo);
export const aprovarChecklist = (fornoId, por, minimo) => b.aprovarChecklist(fornoId, por, minimo);
export const restaurarDemo = () => b.restaurarDemo();
