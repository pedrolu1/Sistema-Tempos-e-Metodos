import { collection, doc, writeBatch, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { buildPayload } from './records.js';
import { sanitizeEtapa } from './projetos.js';
import { auditar } from './auditoria.js';
import { todayISO } from '../utils/format.js';
import { toleranciasPadrao } from '../utils/estudos.js';
import { cronoanaliseDef } from '../pages/estudos/Cronoanalise.js';
import { amostragemDef } from '../pages/estudos/Amostragem.js';
import { mtmDef } from '../pages/estudos/MTM.js';

/**
 * Dados de demonstração: um cenário completo e realista (cliente, 4
 * contratos, 4 projetos, ~200 lançamentos dos últimos 30 dias e 3 estudos)
 * para ver o app funcionando. Tudo leva `demo: true` e sai com um clique.
 * Os números são sorteados com semente fixa: o cenário é sempre o mesmo.
 */

const COLECOES_DEMO = ['lancamentos', 'estudos', 'projetos', 'contratos', 'clientes', 'atividades'];

function sorteador(semente) {
  let a = semente;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ef = (mecanicos = 0, refratarios = 0, montadoresAndaime = 0, operadoresMaquinas = 0, caminhaoMunk = 0) => ({ mecanicos, refratarios, montadoresAndaime, operadoresMaquinas, caminhaoMunk });
const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const minDe = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
function diaISO(deslocamento) {
  const d = new Date(`${todayISO()}T12:00:00`);
  d.setDate(d.getDate() + deslocamento);
  return d.toISOString().slice(0, 10);
}

const ATIVIDADES = [
  { k: '01', nome: 'Montagem de andaime', classificacao: 'DN', min: 120, ef: ef(0, 0, 4) },
  { k: '02', nome: 'Demolição de refratário', classificacao: 'DN', min: 180, ef: ef(1, 3, 0, 1) },
  { k: '03', nome: 'Limpeza e remoção de entulho', classificacao: 'DN', min: 90, ef: ef(0, 2, 0, 1) },
  { k: '04', nome: 'Assentamento de tijolos refratários', classificacao: 'VA', min: 180, ef: ef(1, 4) },
  { k: '05', nome: 'Aplicação de concreto refratário projetado', classificacao: 'VA', min: 150, ef: ef(0, 3, 0, 1) },
  { k: '06', nome: 'Ancoragem e soldagem de grampos', classificacao: 'VA', min: 120, ef: ef(2) },
  { k: '07', nome: 'Cura e secagem controlada', classificacao: 'DN', min: 120, ef: ef(0, 1) },
  { k: '08', nome: 'Inspeção e liberação de qualidade', classificacao: 'DN', min: 60, ef: ef(1) },
  { k: '09', nome: 'Desmontagem de andaime', classificacao: 'DN', min: 90, ef: ef(0, 0, 4) },
  { k: '10', nome: 'Içamento de materiais com munk', classificacao: 'DN', min: 45, ef: ef(0, 0, 0, 1, 1) }
];
const IMPRODUTIVIDADES = [
  { k: 'I1', nome: 'Aguardando liberação de APR/PT', classificacao: 'DNN' },
  { k: 'I2', nome: 'Falta de material refratário', classificacao: 'DNN' },
  { k: 'I3', nome: 'Chuva / condição climática', classificacao: 'DN' },
  { k: 'I4', nome: 'Munk indisponível', classificacao: 'DNN' },
  { k: 'I5', nome: 'Deslocamento até a frente de serviço', classificacao: 'DN' },
  { k: 'I6', nome: 'Aguardando liberação da área pela operação', classificacao: 'DNN' }
];
const JUSTIFICATIVAS = [
  'Refratário muito aderido, foi preciso usar rompedor.',
  'Parada no meio da tarefa para liberação da área.',
  'Equipe reforçada para recuperar o prazo.',
  'Material chegou atrasado e a equipe esperou no posto.',
  'Acesso difícil, andaime precisou de ajuste.'
];

/**
 * Cenário de cada projeto: etapas (código da atividade × execuções
 * necessárias), probabilidade de improdutividade e "personalidade" — é ela
 * que faz o Assistente encontrar algo para mostrar.
 */
const PROJETOS = [
  {
    nome: 'Reparo do duto coletor — Bateria 3', contrato: 'Coqueria', setor: 'Coqueria', status: 'andamento', inicio: -24, fim: 6, apontador: 'João Pereira',
    ficha: { escala: '6x1', horasPorTurno: 8, horaChegada: '07:00', horaSaida: '17:00', almocoInicio: '11:00', almocoFim: '12:00', turmas: 1, efetivo: ef(2, 4, 4, 1), restricoes: ['Liberação de APR antes de iniciar', 'Trabalho a quente — exige PT'] },
    etapas: [['01', 4], ['02', 7], ['03', 4], ['06', 5], ['04', 10], ['07', 3], ['08', 2], ['09', 3]],
    pImprod: 0.45, improds: ['I1', 'I1', 'I2', 'I5'],
    fator: (k) => (k === '02' ? [1.15, 1.4] : [0.9, 1.12]), // demolição sempre passa do planejado
    equipe: (k, r) => (k === '02' && r() < 0.9 ? { refratarios: 5 } : null) // e quase sempre com 2 refratários a mais
  },
  {
    nome: 'Revestimento do canal de corrida', contrato: 'Alto-Forno', setor: 'Alto-Forno', status: 'andamento', inicio: -15, fim: 20, apontador: 'Carla Souza',
    ficha: { escala: '4x4', horasPorTurno: 12, horaChegada: '07:00', horaSaida: '19:00', almocoInicio: '12:00', almocoFim: '13:00', turmas: 2, efetivo: ef(1, 3, 4, 1, 1), restricoes: ['Área confinada — vigia obrigatório'] },
    etapas: [['01', 3], ['02', 5], ['10', 4], ['05', 8], ['07', 3], ['08', 2]],
    pImprod: 0.35, improds: ['I3', 'I4', 'I5'], quatroPorQuatro: true,
    fator: (k) => (k === '05' ? [0.7, 0.85] : [0.88, 1.1]), // concreto projetado mais rápido que o plano
    equipe: () => null
  },
  {
    nome: 'Troca de refratário da panela 2', contrato: 'Aciaria', setor: 'Aciaria', status: 'andamento', inicio: -28, fim: 2, apontador: 'Marcos Lima',
    ficha: { escala: '6x1', horasPorTurno: 8, horaChegada: '07:00', horaSaida: '17:00', almocoInicio: '11:00', almocoFim: '12:00', turmas: 1, efetivo: ef(1, 4, 0, 1), restricoes: ['Panela resfriada abaixo de 60 °C', 'Uso de roupa aluminizada'] },
    etapas: [['02', 10], ['03', 6], ['04', 16], ['07', 4], ['08', 2]],
    pImprod: 0.8, improds: ['I2', 'I2', 'I6', 'I1', 'I4'], longas: true, // muita espera: o prazo fica em risco
    fator: () => [0.92, 1.18],
    equipe: (k, r) => (k === '04' && r() < 0.5 ? { refratarios: 3 } : null)
  },
  {
    nome: 'Reparo de grelha — Regenerador 1', contrato: 'Regenerador', setor: 'Regenerador', status: 'planejado', inicio: 5, fim: 25, apontador: '',
    ficha: { escala: 'adm', horasPorTurno: 8, horaChegada: '07:30', horaSaida: '17:30', almocoInicio: '12:00', almocoFim: '13:00', turmas: 1, efetivo: ef(2, 3, 4), restricoes: [] },
    etapas: [['01', 2], ['06', 3], ['05', 4], ['09', 2]],
    pImprod: 0, improds: [], fator: () => [1, 1], equipe: () => null
  }
];

/**
 * Monta todos os documentos do cenário (sem gravar nada ainda).
 * `novaRef` existe para permitir conferir o cenário fora do navegador.
 */
export function montarCenario(profile, novaRef = (col) => doc(collection(db, col))) {
  const r = sorteador(20261019);
  const entre = ([a, b]) => a + r() * (b - a);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const docs = []; // [colecao, ref, dados]
  const novo = (col, dados) => {
    const ref = novaRef(col);
    docs.push([col, ref, { ...dados, demo: true }]);
    return ref.id;
  };
  const base = { criadoPor: profile.uid, criadoEm: serverTimestamp() };

  // catálogo
  const ativ = {};
  ATIVIDADES.forEach((a) => {
    const id = novo('atividades', { nome: a.nome, codigo: `DEMO-${a.k}`, tipo: 'produtiva', classificacao: a.classificacao, contrato: 'Demonstração', setor: '', local: '', duracaoPadraoMin: a.min, efetivoPadrao: a.ef, ativo: true, ...base });
    ativ[a.k] = { ...a, id };
  });
  IMPRODUTIVIDADES.forEach((a) => {
    const id = novo('atividades', { nome: a.nome, codigo: `DEMO-${a.k}`, tipo: 'improdutiva', classificacao: a.classificacao, contrato: '', setor: '', local: '', duracaoPadraoMin: 0, efetivoPadrao: ef(), ativo: true, ...base });
    ativ[a.k] = { ...a, id };
  });

  // cliente e contratos
  const clienteNome = 'Ternium Brasil';
  const clienteId = novo('clientes', { nome: clienteNome, unidade: 'Santa Cruz — RJ', ativo: true, ...base });
  const contratos = {};
  ['Coqueria', 'Alto-Forno', 'Aciaria', 'Regenerador'].forEach((nome, i) => {
    contratos[nome] = novo('contratos', { nome, numero: `46000${12345 + i}`, clienteId, clienteNome, ativo: true, ...base });
  });

  // projetos + lançamentos
  const projetos = [];
  let nLanc = 0;
  PROJETOS.forEach((cfg) => {
    const etapas = cfg.etapas.map(([k]) => sanitizeEtapa({ atividadeId: ativ[k].id, codigo: `DEMO-${k}`, nome: ativ[k].nome, classificacao: ativ[k].classificacao, duracaoMin: ativ[k].min, efetivo: ativ[k].ef }));
    const projetoId = novo('projetos', {
      nome: cfg.nome, contratoId: contratos[cfg.contrato], contratoNome: cfg.contrato, clienteId, clienteNome, setor: cfg.setor,
      dataInicio: diaISO(cfg.inicio), dataFim: diaISO(cfg.fim), status: cfg.status, ficha: cfg.ficha, etapas, ...base, atualizadoEm: serverTimestamp()
    });
    const projeto = { id: projetoId, cfg, etapas };
    projetos.push(projeto);
    if (cfg.status !== 'andamento') return;

    const f = cfg.ficha;
    const slots = [[minDe(f.horaChegada), minDe(f.almocoInicio)], [minDe(f.almocoFim), minDe(f.horaSaida)]];
    let idx = 0;
    let feitas = 0;
    for (let d = cfg.inicio; d < 0; d++) {
      const data = diaISO(d);
      const diaSemana = new Date(`${data}T12:00:00`).getDay();
      if (cfg.quatroPorQuatro ? Math.floor((d - cfg.inicio) / 4) % 2 === 1 : diaSemana === 0) continue; // folga da escala

      const lanca = (inicio, dur, item, extra = {}) => {
        const input = {
          data, horaInicio: hhmm(inicio), horaTermino: hhmm(inicio + dur), contrato: cfg.contrato, setor: cfg.setor,
          projetoId, projetoNome: cfg.nome, clienteNome, atividadeId: item.id, atividadeNome: item.nome, classificacao: item.classificacao, observacoes: '', ...extra
        };
        novo('lancamentos', {
          ...buildPayload(input),
          criadoPorUid: profile.uid,
          criadoPorNome: cfg.apontador,
          criadoEm: serverTimestamp(),
          criadoEmLocal: new Date(`${data}T${hhmm(inicio)}:00`).getTime(),
          atualizadoEm: serverTimestamp()
        });
        nLanc++;
      };
      const improd = (inicio, max) => {
        const item = ativ[pick(cfg.improds)];
        const dur = Math.min(max, Math.round(entre(cfg.longas ? [40, 120] : [15, 55]) / 5) * 5);
        lanca(inicio, dur, item, { tipoRegistro: 'improdutividade', atividadeTipo: 'improdutiva', efetivo: f.efetivo });
        return dur;
      };

      for (const [ini, fim] of slots) {
        let t = ini;
        if (r() < cfg.pImprod) t += improd(t, fim - t);
        for (;;) {
          const etapa = etapas[idx];
          if (!etapa) break;
          const k = cfg.etapas[idx][0];
          const dur = Math.max(15, Math.round((etapa.duracaoMin * entre(cfg.fator(k))) / 5) * 5);
          if (t + dur > fim) {
            // a etapa não cabe no que sobrou do período: a equipe espera a próxima janela
            if (fim - t >= 20 && cfg.improds.length && r() < 0.5) t += improd(t, fim - t);
            break;
          }
          const equipe = { ...etapa.efetivo, ...(cfg.equipe(k, r) || {}) };
          const passou = dur > etapa.duracaoMin || Object.keys(equipe).some((c) => equipe[c] > (etapa.efetivo[c] || 0));
          lanca(t, dur, ativ[k], {
            tipoRegistro: 'atividade', atividadeTipo: 'produtiva', etapaId: etapa.id, duracaoPadraoMin: etapa.duracaoMin,
            efetivoPadrao: etapa.efetivo, efetivo: equipe, justificativa: passou ? pick(JUSTIFICATIVAS) : ''
          });
          t += dur;
          if (++feitas >= cfg.etapas[idx][1]) {
            idx++;
            feitas = 0;
          }
          if (cfg.improds.length && r() < 0.2 && fim - t > 30) t += improd(t, 25);
        }
      }
    }
  });

  // estudos
  const [p1, p2, p3] = projetos;
  const etapa = (p, k) => p.etapas.find((e) => e.codigo === `DEMO-${k}`);
  const alvo = (p, k) => ({ projetoId: p.id, projetoNome: p.cfg.nome, contratoNome: p.cfg.contrato, clienteNome, etapaId: etapa(p, k).id, atividadeId: etapa(p, k).atividadeId, atividadeNome: etapa(p, k).nome });
  const estudo = (def, st) => {
    const s = JSON.parse(JSON.stringify(def.salvar(st))); // tira campos vazios que o Firestore recusa
    novo('estudos', { tipo: def.tipo, titulo: s.titulo, alvo: s.alvo, dados: s.dados, resultado: s.resultado, criadoPorUid: profile.uid, criadoPorNome: profile.nomeCompleto || '', criadoEm: serverTimestamp(), criadoEmLocal: Date.now() - 2 * 86400000 });
  };
  const tol = toleranciasPadrao();
  tol.calor.ativo = true;
  tol.epi.ativo = true;
  const leituras = Array.from({ length: 24 }, () => Math.round((26 + r() * 9) * 10) / 10);
  leituras[9] = 48.6; // um ciclo com interrupção
  estudo(cronoanaliseDef, { ...cronoanaliseDef.estadoInicial(), alvo: alvo(p1, '04'), operacao: 'Assentar 1 tijolo refratário na parede do duto', unidade: 'tijolo', operador: 'Turma A', leituras, descartadas: [9], ritmo: 1.05, tolerancias: tol, quantidade: 320 });
  estudo(amostragemDef, { ...amostragemDef.estadoInicial(), alvo: { projetoId: p3.id, projetoNome: p3.cfg.nome, contratoNome: p3.cfg.contrato, clienteNome }, equipe: 'Turma B — panela 2',
    contagens: { Trabalhando: 196, 'Aguardando material': 48, 'Aguardando liberação (APR/PT)': 39, Deslocamento: 24, 'Parado / ocioso': 21, Outros: 8 } });
  estudo(mtmDef, { ...mtmDef.estadoInicial(), alvo: alvo(p2, '05'), operacao: 'Pegar bloco do palete e posicionar no molde', quantidade: 180,
    elementos: [
      { cod: 'R50B', nome: 'Alcançar objeto em local variável — 50 cm', tmu: 18.6, freq: 1 },
      { cod: 'G1A', nome: 'Pegar objeto fácil, isolado', tmu: 2, freq: 1 },
      { cod: 'M50B', nome: 'Mover para local aproximado — 50 cm', tmu: 18.2, freq: 1 },
      { cod: 'P1SE', nome: 'Encaixe folgado, simétrico, fácil', tmu: 5.6, freq: 1 },
      { cod: 'RL1', nome: 'Soltar abrindo os dedos', tmu: 2, freq: 1 },
      { cod: 'B', nome: 'Curvar-se', tmu: 29, freq: 1 },
      { cod: 'AB', nome: 'Levantar-se da curvatura', tmu: 31.9, freq: 1 }
    ] });

  return { docs, resumo: { projetos: projetos.length, lancamentos: nLanc, estudos: 3, atividades: ATIVIDADES.length + IMPRODUTIVIDADES.length } };
}

async function gravarEmLotes(operacoes) {
  for (let i = 0; i < operacoes.length; i += 400) {
    const lote = writeBatch(db);
    operacoes.slice(i, i + 400).forEach((op) => op(lote));
    await lote.commit();
  }
}

export async function carregarDemo(profile) {
  const { docs, resumo } = montarCenario(profile);
  await gravarEmLotes(docs.map(([, ref, dados]) => (lote) => lote.set(ref, dados)));
  auditar('criou', 'demonstração', '', `${resumo.projetos} projetos, ${resumo.lancamentos} lançamentos, ${resumo.estudos} estudos`);
  return resumo;
}

export async function removerDemo() {
  const refs = [];
  for (const col of COLECOES_DEMO) {
    const snap = await getDocs(query(collection(db, col), where('demo', '==', true)));
    snap.docs.forEach((d) => refs.push(d.ref));
  }
  await gravarEmLotes(refs.map((ref) => (lote) => lote.delete(ref)));
  auditar('excluiu', 'demonstração', '', `${refs.length} registros de demonstração`);
  return refs.length;
}
