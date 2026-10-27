// Tudo o que o app mostra sai daqui: estado de cada primária, avanço,
// curvas, RDO do dia, XP e conquistas. Funções puras sobre o estado do banco.
import { SEED_BATERIAS, SEED_EPOCH, SEED_CURVA } from '../data/seed.js';
import {
  PRIMARIAS, FORNOS, ETAPAS, etapaPorId, contratoAtivo, blocosDa, fornoPorId, primariaPorId,
  MATERIAIS, primariasDoAlvo, BATERIAS, BLOCOS_POR_BATERIA, FORNOS_POR_BLOCO, RDO_ULTIMO, noMeio
} from '../data/obra.js';
import { somarDias, semana, inicioDaSemana, hoje, diaUtil, diaUtilAnterior, bm } from './datas.js';

const N_ETAPAS = ETAPAS.length;
const IDX = Object.fromEntries(ETAPAS.map((e, i) => [e.id, i]));

// ---------------------------------------------------------------------------
// Histórico das planilhas: demolição, instalação e revestimento por primária.
// Andaime vale como feito junto com a demolição e 5S/sopragem junto com a
// instalação (a planilha não registrava essas duas); revestimento = siplate
// + massa 1200.
// ---------------------------------------------------------------------------
const base = PRIMARIAS.map(() => new Array(N_ETAPAS).fill(null));
BATERIAS.forEach((bat, bi) => {
  const arr = SEED_BATERIAS[bat];
  for (let k = 0; k < BLOCOS_POR_BATERIA * FORNOS_POR_BLOCO * 6; k++) {
    const [d0, d1, d2] = [arr[k * 3], arr[k * 3 + 1], arr[k * 3 + 2]].map((n) => (n >= 0 ? somarDias(SEED_EPOCH, n) : null));
    const b = base[bi * BLOCOS_POR_BATERIA * FORNOS_POR_BLOCO * 6 + k];
    if (d0) b[IDX.andaime] = b[IDX.demolicao] = d0;
    if (d1) b[IDX.sopragem] = b[IDX.assentamento] = d1;
    if (d2) b[IDX.siplate] = b[IDX.massa1200] = d2;
  }
});

let cache = { versao: -1, calc: null };

/** Estado calculado; recalcula só quando o banco muda. */
export function calcular(estado) {
  if (cache.versao === estado.versao && cache.calc) return cache.calc;
  const feitas = base.map((b) => b.slice());
  const quem = PRIMARIAS.map(() => new Array(N_ETAPAS).fill(null)); // id do lançamento que fez
  const validos = estado.lancamentos.filter((l) => l.status === 'valido').sort((a, b) => a.criadoEm - b.criadoEm);
  for (const l of validos) {
    const e = IDX[l.etapa];
    for (const pid of l.prims) {
      const i = primariaPorId[pid].idx;
      if (!feitas[i][e] || l.data < feitas[i][e]) {
        feitas[i][e] = l.data;
        quem[i][e] = l.id;
      }
    }
  }
  // etapa mais avançada feita em cada primária (-1 = nada)
  const nivel = feitas.map((f) => {
    for (let e = N_ETAPAS - 1; e >= 0; e--) if (f[e]) return e;
    return -1;
  });
  // forno concluído = as 6 primárias com massa 1200; vale a data da última
  const fornos = {};
  for (const f of FORNOS) {
    const ids = f.prims.map((id) => primariaPorId[id].idx);
    const finais = ids.map((i) => feitas[i][N_ETAPAS - 1]);
    const concluidoEm = finais.every(Boolean) ? finais.reduce((a, b) => (a > b ? a : b)) : null;
    // quem fechou: o lançamento da última massa 1200 do forno
    const fechouLanc = concluidoEm ? ids.map((i) => quem[i][N_ETAPAS - 1]).find((q, k) => q && finais[k] === concluidoEm) || null : null;
    fornos[f.id] = { concluidoEm, fechouLanc, niveis: ids.map((i) => nivel[i]), minimo: Math.min(...ids.map((i) => nivel[i])) };
  }
  const blocos = {};
  for (const bat of BATERIAS) {
    for (const bl of blocosDa(bat)) {
      const fs = FORNOS.filter((f) => f.bloco === bl).map((f) => fornos[f.id]);
      const concl = fs.filter((f) => f.concluidoEm);
      blocos[bl] = { concluidos: concl.length, concluidoEm: concl.length === fs.length ? concl.map((f) => f.concluidoEm).sort().pop() : null };
    }
  }
  const lancPorId = Object.fromEntries(estado.lancamentos.map((l) => [l.id, l]));
  const calc = { versao: estado.versao, estado, feitas, quem, nivel, fornos, blocos, validos, lancPorId };
  cache = { versao: estado.versao, calc };
  return calc;
}

// ---------------------------------------------------------------------------
// Regras do lançamento
// ---------------------------------------------------------------------------

/**
 * Se a etapa pode ser lançada naquele alvo (primária, cabeceira ou forno).
 * As etapas seguem a ordem: só libera quando a anterior está feita.
 */
export function situacaoAlvo(calc, etapaId, alvo) {
  const e = IDX[etapaId];
  const idxs = primariasDoAlvo(alvo).map((id) => primariaPorId[id].idx);
  const feitas = idxs.filter((i) => calc.feitas[i][e]).length;
  if (feitas === idxs.length) return { ok: false, feito: true, motivo: 'Já lançada' };
  if (e > 0) {
    const faltando = idxs.filter((i) => !calc.feitas[i][e - 1]).length;
    if (faltando) return { ok: false, motivo: `Falta ${noMeio(ETAPAS[e - 1])}` };
  }
  return { ok: true, parcial: feitas > 0 };
}

/** Alvos de uma etapa num forno (primárias, cabeceiras ou o forno), com a situação de cada um. */
export function alvosDoForno(calc, etapaId, fid) {
  const nivel = etapaPorId[etapaId].nivel;
  const ids = nivel === 'forno' ? [fid] : nivel === 'cabeceira' ? [`${fid}-LM`, `${fid}-LC`] : fornoPorId[fid].prims;
  return ids.map((id) => ({ id, ...situacaoAlvo(calc, etapaId, id) }));
}

/** Peso de cada etapa normalizado (somam 1). */
export function pesosNormalizados(config) {
  const total = ETAPAS.reduce((s, e) => s + (Number(config.pesos[e.id]) || 0), 0) || 1;
  return ETAPAS.map((e) => (Number(config.pesos[e.id]) || 0) / total);
}

/** Avanço físico ponderado (0 a 1) de um conjunto de primárias, até uma data (inclusive). */
export function avancoFisico(calc, idxs, ate = null) {
  const w = pesosNormalizados(calc.estado.config);
  let soma = 0;
  for (const i of idxs) {
    const f = calc.feitas[i];
    for (let e = 0; e < N_ETAPAS; e++) if (f[e] && (!ate || f[e] <= ate)) soma += w[e];
  }
  return idxs.length ? soma / idxs.length : 0;
}

export const idxsDaBateria = (bat) => PRIMARIAS.filter((p) => p.bateria === bat).map((p) => p.idx);
export const idxsDoForno = (fid) => fornoPorId[fid].prims.map((id) => primariaPorId[id].idx);
export const idxsDoBloco = (bl) => PRIMARIAS.filter((p) => p.bloco === bl).map((p) => p.idx);

// ---------------------------------------------------------------------------
// Curva S do contrato ativo: previsto da planilha, realizado = fornos
// concluídos na semana; mais a curva física ponderada pelas 6 etapas.
// ---------------------------------------------------------------------------
export function curvaS(calc) {
  const contrato = contratoAtivo();
  const fornosBat = FORNOS.filter((f) => f.bateria === contrato.bateria);
  const escopo = fornosBat.length;
  const idxs = idxsDaBateria(contrato.bateria);
  const replan = calc.estado.config.replanejado || {};
  const dataHoje = hoje();
  const concluido = (f) => calc.fornos[f.id].concluidoEm;
  let pa = 0;
  let rp = 0;
  let ra = fornosBat.filter((f) => concluido(f) && concluido(f) < inicioDaSemana(SEED_CURVA[0].inicio)).length;
  const pontos = SEED_CURVA.map((s) => {
    // semana inteira (seg a dom): na planilha a linha da semana às vezes para no dia 15 por causa do BM
    const naSemana = fornosBat.filter((f) => concluido(f) && semana(concluido(f)) === s.semana).length;
    const replanejado = replan[s.semana] ?? null;
    const futuro = inicioDaSemana(s.inicio) > dataHoje;
    pa += s.previsto;
    rp += replanejado ?? s.previsto;
    ra += naSemana;
    return {
      ...s,
      replanejado,
      previstoAcum: pa,
      replanejadoAcum: rp,
      realizado: futuro ? null : naSemana,
      realizadoAcum: futuro ? null : ra,
      fisico: futuro ? null : avancoFisico(calc, idxs, somarDias(inicioDaSemana(s.inicio), 6) < dataHoje ? somarDias(inicioDaSemana(s.inicio), 6) : dataHoje),
      atual: dataHoje >= s.inicio && dataHoje <= s.fim
    };
  });
  return { escopo, pontos };
}

/** Meta e realizado da semana corrente (fornos concluídos). */
export function semanaAtual(calc, data = hoje()) {
  const { pontos, escopo } = curvaS(calc);
  const p = pontos.find((x) => data >= x.inicio && data <= x.fim) || null;
  const contrato = contratoAtivo();
  const ini = inicioDaSemana(data);
  const fim = somarDias(ini, 6);
  const fechados = FORNOS.filter((f) => f.bateria === contrato.bateria && calc.fornos[f.id].concluidoEm >= ini && calc.fornos[f.id].concluidoEm <= fim).length;
  return { semana: semana(data), meta: p ? p.replanejado ?? p.previsto : 0, fechados, escopo };
}

// ---------------------------------------------------------------------------
// RDO do dia montado a partir dos lançamentos
// ---------------------------------------------------------------------------

/** Agrupa alvos como no RDO: "B6 · F07 · LM · P01 P02 P03", "B6 · F07 · LM/LC". */
export function resumoAlvos(prims, etapaId) {
  const nivel = etapaPorId[etapaId].nivel;
  const porForno = new Map();
  for (const id of prims) {
    const p = primariaPorId[id];
    if (!porForno.has(p.fornoId)) porForno.set(p.fornoId, []);
    porForno.get(p.fornoId).push(p);
  }
  const linhas = [];
  const pn = (p) => `P${String(p.p).padStart(2, '0')}`;
  for (const [fid, ps] of [...porForno.entries()].sort()) {
    const nome = fid.replace('-', ' · ');
    const lados = ['LM', 'LC'].map((lado) => ps.filter((p) => p.lado === lado).sort((a, b) => a.p - b.p)).filter((l) => l.length);
    if (nivel === 'forno' || ps.length === 6 || (nivel === 'cabeceira' && lados.length === 2)) linhas.push(`${nome} · LM/LC`);
    else if (nivel === 'cabeceira') linhas.push(`${nome} · ${lados[0][0].lado}`);
    else for (const l of lados) linhas.push(`${nome} · ${l[0].lado} · ${l.map(pn).join(' ')}`);
  }
  return linhas;
}

/** Primárias que tiveram a etapa concluída no dia, na bateria do contrato ativo. */
export function primariasDoDia(calc, data, etapaId) {
  const e = IDX[etapaId];
  const bat = contratoAtivo().bateria;
  return PRIMARIAS.filter((p) => p.bateria === bat && calc.feitas[p.idx][e] === data).map((p) => p.id);
}

export function rdoDoDia(calc, data) {
  const bat = contratoAtivo().bateria;
  const atividades = ETAPAS.map((et) => {
    const prims = primariasDoDia(calc, data, et.id);
    return { etapa: et, prims, linhas: resumoAlvos(prims, et.id) };
  }).filter((a) => a.prims.length);
  const daBat = PRIMARIAS.filter((p) => p.bateria === bat);
  const materiais = MATERIAIS.map((m) => {
    const e = IDX[m.etapa];
    let anterior = 0;
    let aplicado = 0;
    for (const p of daBat) {
      const d = calc.feitas[p.idx][e];
      if (!d || d > data) continue;
      if (d === data) aplicado++;
      else anterior++;
    }
    return { ...m, anterior: anterior * m.porPrimaria, aplicado: aplicado * m.porPrimaria, acumulado: (anterior + aplicado) * m.porPrimaria };
  });
  const salvo = calc.estado.rdos[data] || null;
  // até o último RDO da planilha, o relatório já foi emitido fora do app
  const status = salvo?.status || (data <= RDO_ULTIMO.data ? 'planilha' : 'rascunho');
  return { data, numero: salvo?.numero ?? numeroRdo(calc, data), atividades, materiais, salvo, status };
}

/** Numeração continua a da planilha: um RDO por dia útil depois do último emitido. */
export function numeroRdo(calc, data) {
  if (data <= RDO_ULTIMO.data) return null;
  let n = RDO_ULTIMO.numero;
  for (let d = somarDias(RDO_ULTIMO.data, 1); d <= data; d = somarDias(d, 1)) if (diaUtil(d)) n++;
  return diaUtil(data) ? n : null;
}

// ---------------------------------------------------------------------------
// Pessoas: XP, nível (em °C, até 1200 °C), sequência de dias e conquistas
// ---------------------------------------------------------------------------
export const XP_POR_PRIMARIA = 10;
export const XP_FORNO = 100;
export const XP_BLOCO = 500;
export const NIVEL_MAX = 12;
const limiar = (n) => 50 * (n - 1) * n; // XP para chegar ao nível n

export function nivelDoXp(xp) {
  let n = 1;
  while (n < NIVEL_MAX && xp >= limiar(n + 1)) n++;
  const de = limiar(n);
  const ate = n < NIVEL_MAX ? limiar(n + 1) : de;
  return { nivel: n, graus: n * 100, de, ate, fracao: n < NIVEL_MAX ? (xp - de) / (ate - de) : 1 };
}

export function statsPessoa(calc, uid) {
  const meus = calc.validos.filter((l) => l.autor?.uid === uid);
  const meusIds = new Set(meus.map((l) => l.id));
  const etapas = meus.reduce((s, l) => s + l.prims.length, 0);
  const fornosFechados = FORNOS.filter((f) => meusIds.has(calc.fornos[f.id].fechouLanc));
  const blocosFechados = new Set();
  for (const f of fornosFechados) if (calc.blocos[f.bloco].concluidoEm === calc.fornos[f.id].concluidoEm) blocosFechados.add(f.bloco);
  const xp = etapas * XP_POR_PRIMARIA + fornosFechados.length * XP_FORNO + blocosFechados.size * XP_BLOCO;
  const dias = new Set(meus.map((l) => l.data));
  const hj = hoje();
  // sequência de dias úteis com lançamento; hoje ainda sem lançamento não quebra
  let seq = 0;
  let d = diaUtil(hj) ? hj : diaUtilAnterior(hj);
  if (!dias.has(d)) d = diaUtilAnterior(d);
  while (dias.has(d)) {
    seq++;
    d = diaUtilAnterior(d);
  }
  const hojeEtapas = meus.filter((l) => l.data === hj).reduce((s, l) => s + l.prims.length, 0);
  const pedidos = calc.estado.correcoes.filter((c) => c.autor?.uid === uid).length;
  const s = { uid, lancamentos: meus.length, etapas, hojeEtapas, fornos: fornosFechados.length, blocos: blocosFechados.size, xp, sequencia: seq, dias: dias.size, pedidos, ...nivelDoXp(xp) };
  s.conquistas = CONQUISTAS.map((c) => ({ ...c, ganha: c.teste(s, calc) }));
  return s;
}

export const CONQUISTAS = [
  { id: 'faisca', nome: 'Primeira faísca', desc: 'Fez o primeiro lançamento', teste: (s) => s.lancamentos >= 1 },
  { id: 'forno', nome: 'Forno fechado', desc: 'Lançou a massa 1200 que fechou um forno', teste: (s) => s.fornos >= 1 },
  { id: 'dez-fornos', nome: 'Dez fornos', desc: 'Fechou 10 fornos', teste: (s) => s.fornos >= 10 },
  { id: 'bloco', nome: 'Bloco aceso', desc: 'Fechou o último forno de um bloco', teste: (s) => s.blocos >= 1 },
  { id: 'sequencia', nome: 'Cinco seguidos', desc: '5 dias úteis seguidos lançando', teste: (s) => s.sequencia >= 5 },
  { id: 'cem', nome: 'Cem etapas', desc: '100 etapas de primária lançadas', teste: (s) => s.etapas >= 100 },
  { id: 'mao-firme', nome: 'Mão firme', desc: '20 lançamentos sem pedir correção', teste: (s) => s.lancamentos >= 20 && s.pedidos === 0 },
  { id: 'brasa', nome: 'Brasa viva', desc: 'Chegou a 1200 °C', teste: (s) => s.nivel >= NIVEL_MAX }
];

/** O que um lançamento novo provocou: fornos e blocos fechados (para comemorar). */
export function efeitosDoLancamento(antes, depois, lanc) {
  const fornos = [...new Set(lanc.prims.map((id) => primariaPorId[id].fornoId))].filter((fid) => !antes.fornos[fid].concluidoEm && depois.fornos[fid].concluidoEm);
  const blocos = [...new Set(fornos.map((fid) => fornoPorId[fid].bloco))].filter((bl) => !antes.blocos[bl].concluidoEm && depois.blocos[bl].concluidoEm);
  return { fornos, blocos };
}

// ---------------------------------------------------------------------------
// Resumos para o painel
// ---------------------------------------------------------------------------
export function contagemPorEtapa(calc, bat) {
  const c = new Array(N_ETAPAS + 1).fill(0); // índice 0 = pendente
  for (const p of PRIMARIAS) if (p.bateria === bat) c[calc.nivel[p.idx] + 1]++;
  return c;
}

/** Etapas lançadas por dia (primária × etapa) num intervalo, separadas por etapa. */
export function producaoDiaria(calc, de, ate) {
  const bat = contratoAtivo().bateria;
  const dias = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) dias.push(d);
  const pos = Object.fromEntries(dias.map((d, i) => [d, i]));
  const serie = ETAPAS.map(() => new Array(dias.length).fill(0));
  for (const p of PRIMARIAS) {
    if (p.bateria !== bat) continue;
    const f = calc.feitas[p.idx];
    for (let e = 0; e < N_ETAPAS; e++) if (f[e] && pos[f[e]] !== undefined) serie[e][pos[f[e]]]++;
  }
  return { dias, serie };
}

/** Fornos concluídos agrupados por boletim de medição (BM). */
export function fornosPorBm(calc) {
  const bat = contratoAtivo().bateria;
  const grupos = {};
  for (const f of FORNOS) {
    const d = calc.fornos[f.id].concluidoEm;
    if (f.bateria !== bat || !d) continue;
    (grupos[bm(d)] ||= []).push({ ...f, concluidoEm: d });
  }
  for (const g of Object.values(grupos)) g.sort((a, b) => a.concluidoEm.localeCompare(b.concluidoEm) || a.id.localeCompare(b.id));
  return grupos;
}

/**
 * Checklist de entrega de cada forno concluído do contrato. Os fornos que já
 * vieram da planilha entram aprovados, numerados como na medição: na ordem em
 * que os blocos fecharam e, dentro do bloco, pela ordem dos fornos.
 */
export function checklists(calc) {
  const bat = contratoAtivo().bateria;
  const salvos = calc.estado.checklists;
  const itensModelo = calc.estado.config.checklist;
  const concluidos = FORNOS.filter((f) => f.bateria === bat && calc.fornos[f.id].concluidoEm);
  const fimDoBloco = (bl) => concluidos.filter((f) => f.bloco === bl).map((f) => calc.fornos[f.id].concluidoEm).sort().pop();
  const daPlanilha = concluidos
    .filter((f) => !calc.fornos[f.id].fechouLanc && !salvos[f.id])
    .sort((a, b) => fimDoBloco(a.bloco).localeCompare(fimDoBloco(b.bloco)) || a.bloco.localeCompare(b.bloco) || a.forno - b.forno);
  const mapa = {};
  daPlanilha.forEach((f, i) => {
    mapa[f.id] = { numero: i + 1, status: 'aprovado', itens: itensModelo.map(() => true), origem: 'planilha' };
  });
  let proximo = daPlanilha.length + Object.values(salvos).filter((c) => c.numero).length + 1;
  for (const f of concluidos) {
    if (mapa[f.id]) continue;
    const s = salvos[f.id];
    mapa[f.id] = s ? { ...s, itens: itensModelo.map((_, i) => Boolean(s.itens?.[i])) } : { numero: null, status: 'pendente', itens: itensModelo.map(() => false), proximo };
  }
  // fornos ainda em obra também podem ter o checklist começado
  for (const [fid, s] of Object.entries(salvos)) if (!mapa[fid]) mapa[fid] = { ...s, itens: itensModelo.map((_, i) => Boolean(s.itens?.[i])) };
  return mapa;
}

export { IDX as INDICE_ETAPA, N_ETAPAS };
