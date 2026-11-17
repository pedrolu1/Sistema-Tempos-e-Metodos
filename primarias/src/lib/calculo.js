// Tudo o que o app mostra sai daqui: estado de cada primária, avanço, Curva S
// por BM, RDO do dia, checklist com fotos, XP e conquistas. Funções puras
// sobre o estado do banco.
import { SEED_BATERIAS, SEED_EPOCH, SEED_VALORES_POR_PRIMARIA } from '../data/seed.js';
import {
  PRIMARIAS, FORNOS, ETAPAS, etapaPorId, contratoAtivo, blocosDa, fornoPorId, primariaPorId,
  MATERIAIS, primariasDoAlvo, BATERIAS, RDO_ULTIMO, noMeio, META_FORNOS_BM, SLOTS_FOTO
} from '../data/obra.js';
import { somarDias, semana, hoje, diaUtil, diaUtilAnterior, bm, bmDaSemana, semanasDoBm, periodoBm, bmsEntre } from './datas.js';

const N_ETAPAS = ETAPAS.length;
const IDX = Object.fromEntries(ETAPAS.map((e, i) => [e.id, i]));
// etapas que pintam o mapa, na ordem (a desmontagem fica de fora)
const I_MAPA = ETAPAS.map((e, i) => (e.extra ? -1 : i)).filter((i) => i >= 0);
const I_MASSA = IDX.massa1200;

// ---------------------------------------------------------------------------
// Base histórica, da planilha de Gestão Visual: por primária, fim da demolição,
// fim da instalação, início e fim do revestimento e, com 5 valores, se o
// andaime está montado (coluna K). A montagem do andaime vale junto com a
// demolição e o Injetbar junto com o início do revestimento. Primária
// revestida com andaime "NÃO" na planilha entra com o andaime desmontado.
// O planejador atualiza essa base pela tela Configuração; sem isso, vale a
// que veio com o app.
// ---------------------------------------------------------------------------
function montarBase({ epoch, baterias, valores = 4 }) {
  const base = PRIMARIAS.map(() => new Array(N_ETAPAS).fill(null));
  const porBateria = PRIMARIAS.length / BATERIAS.length;
  BATERIAS.forEach((bat, bi) => {
    const arr = baterias[bat];
    if (!arr) return;
    for (let k = 0; k < porBateria; k++) {
      const brutos = Array.from({ length: valores }, (_, j) => arr[k * valores + j]);
      const v = brutos.slice(0, Math.min(valores, 4)).map((n) => (n >= 0 ? somarDias(epoch, n) : null));
      const [demo, inst] = v;
      const iniRev = valores >= 4 ? v[2] : null;
      const fimRev = valores >= 4 ? v[3] : v[valores - 1];
      const andaimeNaPlanilha = valores >= 5 ? brutos[4] === 1 : null;
      const b = base[bi * porBateria + k];
      if (demo) b[IDX.andaime] = b[IDX.demolicao] = demo;
      if (inst) b[IDX.assentamento] = inst;
      if (iniRev || fimRev) b[IDX.injetbar] = iniRev || fimRev;
      if (fimRev) b[IDX.massa1200] = fimRev;
      // revestida e sem andaime na planilha: o andaime já foi desmontado
      if (andaimeNaPlanilha === false && demo && fimRev) b[IDX.desmontagem] = fimRev;
    }
  });
  return base;
}
const baseDoApp = montarBase({ epoch: SEED_EPOCH, baterias: SEED_BATERIAS, valores: SEED_VALORES_POR_PRIMARIA });
let baseImportada = { fonte: null, base: null };
function baseAtual(estado) {
  const fonte = estado.base;
  if (!fonte?.baterias) return baseDoApp;
  if (baseImportada.fonte !== fonte) baseImportada = { fonte, base: montarBase(fonte) };
  return baseImportada.base;
}

let cache = { versao: -1, calc: null };

/** Estado calculado; recalcula só quando o banco muda. */
export function calcular(estado) {
  if (cache.versao === estado.versao && cache.calc) return cache.calc;
  const feitas = baseAtual(estado).map((b) => b.slice());
  const quem = PRIMARIAS.map(() => new Array(N_ETAPAS).fill(null)); // id do lançamento que fez
  const validos = estado.lancamentos
    .filter((l) => l.status === 'valido' && IDX[l.etapa] !== undefined)
    .sort((a, b) => a.criadoEmLocal - b.criadoEmLocal);
  for (const l of validos) {
    const e = IDX[l.etapa];
    for (const pid of l.prims) {
      const p = primariaPorId[pid];
      if (!p) continue;
      if (!feitas[p.idx][e] || l.data < feitas[p.idx][e]) {
        feitas[p.idx][e] = l.data;
        quem[p.idx][e] = l.id;
      }
    }
  }
  // etapa mais avançada do mapa em cada primária (-1 = nada); índice dentro de I_MAPA
  const nivel = feitas.map((f) => {
    for (let k = I_MAPA.length - 1; k >= 0; k--) if (f[I_MAPA[k]]) return k;
    return -1;
  });
  // forno concluído = as 6 primárias com massa 1200; vale a data da última
  const fornos = {};
  for (const f of FORNOS) {
    const ids = f.prims.map((id) => primariaPorId[id].idx);
    const finais = ids.map((i) => feitas[i][I_MASSA]);
    const concluidoEm = finais.every(Boolean) ? finais.reduce((a, b) => (a > b ? a : b)) : null;
    const fechouLanc = concluidoEm ? ids.map((i) => quem[i][I_MASSA]).find((q, k) => q && finais[k] === concluidoEm) || null : null;
    const andaime = {};
    for (const lado of ['LM', 'LC']) {
      const doLado = ids.filter((i) => PRIMARIAS[i].lado === lado);
      const montado = doLado.every((i) => feitas[i][IDX.andaime]);
      const desmontado = doLado.every((i) => feitas[i][IDX.desmontagem]);
      andaime[lado] = desmontado ? 'desmontado' : montado ? 'montado' : null;
    }
    fornos[f.id] = { concluidoEm, fechouLanc, niveis: ids.map((i) => nivel[i]), minimo: Math.min(...ids.map((i) => nivel[i])), andaime };
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
// Regras do lançamento: as etapas seguem a ordem do serviço.
// ---------------------------------------------------------------------------

/** Se a etapa pode ser lançada naquele alvo (primária, lado ou forno). */
export function situacaoAlvo(calc, etapaId, alvo) {
  const e = IDX[etapaId];
  const idxs = primariasDoAlvo(alvo).map((id) => primariaPorId[id].idx);
  const feitas = idxs.filter((i) => calc.feitas[i][e]).length;
  if (feitas === idxs.length) return { ok: false, feito: true, motivo: 'Já lançada' };
  const antes = etapaId === 'desmontagem' ? IDX.andaime : e - 1;
  if (antes >= 0) {
    const faltando = idxs.filter((i) => !calc.feitas[i][antes]).length;
    if (faltando) return { ok: false, motivo: `Falta ${noMeio(ETAPAS[antes])}` };
  }
  return { ok: true, parcial: feitas > 0 };
}

/** Alvos de uma etapa num forno (primárias ou lados), com a situação de cada um. */
export function alvosDoForno(calc, etapaId, fid) {
  const nivel = etapaPorId[etapaId].nivel;
  const ids = nivel === 'forno' ? [fid] : nivel === 'cabeceira' ? [`${fid}-LM`, `${fid}-LC`] : fornoPorId[fid].prims;
  return ids.map((id) => ({ id, ...situacaoAlvo(calc, etapaId, id) }));
}

/** Próxima etapa liberada num lado do forno (para o botão grande da tela do forno). */
export function proximaDoLado(calc, fid, lado) {
  for (const e of ETAPAS) {
    const alvos = alvosDoForno(calc, e.id, fid).filter((a) => (e.nivel === 'cabeceira' ? a.id.endsWith(lado) : primariaPorId[a.id].lado === lado));
    const livres = alvos.filter((a) => a.ok);
    if (livres.length) return { etapa: e, alvos: livres.map((a) => a.id) };
  }
  return null;
}

/** Peso de cada etapa no avanço físico (somam 1). Sem configuração: iguais, sem a desmontagem. */
export function pesosNormalizados(config) {
  const pesos = ETAPAS.map((e) => {
    const v = config?.pesos?.[e.id];
    return v === undefined || v === null || v === '' ? (e.extra ? 0 : 1) : Number(v) || 0;
  });
  const total = pesos.reduce((s, n) => s + n, 0) || 1;
  return pesos.map((n) => n / total);
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
// Curva S de revestimento: só fornos (as 6 primárias com massa 1200), por BM
// (dia 16 ao dia 15), meta mensal configurável (36). A semana inteira conta no
// BM da sua segunda-feira. Semana sem revestimento fica com zero.
// ---------------------------------------------------------------------------
export const metaDoBm = (calc) => Number(calc.estado.config?.metaBm) || META_FORNOS_BM;
export const bmAtual = () => bmDaSemana(hoje());

/** Meta de cada semana: a meta do BM dividida igualmente (a sobra vai para as primeiras), ou a ajustada pelo planejador. */
function metasDasSemanas(calc, bmId, semanas) {
  const meta = metaDoBm(calc);
  const base = Math.floor(meta / semanas.length);
  let sobra = meta - base * semanas.length;
  const ajustes = calc.estado.config?.metaSemanas || {};
  return semanas.map((s) => {
    const ajustada = ajustes[`${bmId}:${s.semana}`];
    if (ajustada !== undefined && ajustada !== null && ajustada !== '') return Number(ajustada);
    const v = base + (sobra > 0 ? 1 : 0);
    if (sobra > 0) sobra--;
    return v;
  });
}

export function curvaBm(calc, bmId = bmAtual()) {
  const bat = contratoAtivo().bateria;
  const { inicio, fim } = periodoBm(bmId);
  const semanas = semanasDoBm(bmId);
  const metas = metasDasSemanas(calc, bmId, semanas);
  const fornosBat = FORNOS.filter((f) => f.bateria === bat);
  const dataHoje = hoje();
  let ma = 0;
  let ra = 0;
  const pontos = semanas.map((s, i) => {
    const fechados = fornosBat.filter((f) => {
      const d = calc.fornos[f.id].concluidoEm;
      return d && d >= s.ini && d <= s.fim;
    });
    const futuro = s.ini > dataHoje;
    ma += metas[i];
    ra += fechados.length;
    return {
      ...s,
      meta: metas[i],
      metaAcum: ma,
      realizado: futuro ? null : fechados.length,
      realizadoAcum: futuro ? null : ra,
      fornos: fechados.map((f) => f.id),
      atual: dataHoje >= s.ini && dataHoje <= s.fim,
      futuro
    };
  });
  const meta = metas.reduce((s, n) => s + n, 0);
  const atual = pontos.find((p) => p.atual) || null;
  const restantes = pontos.filter((p) => p.futuro || p.atual).length;
  const faltam = Math.max(0, meta - ra);
  return { bm: bmId, inicio, fim, meta, realizado: ra, faltam, pontos, atual, ritmo: restantes ? Math.ceil(faltam / restantes) : 0 };
}

/** BMs do contrato até o atual, com meta e realizado de cada um. */
export function bmsDoContrato(calc) {
  const contrato = contratoAtivo();
  return bmsEntre(bm(contrato.inicio), bmAtual()).map((id) => {
    const c = curvaBm(calc, id);
    return { bm: id, inicio: c.inicio, fim: c.fim, meta: c.meta, realizado: c.realizado };
  });
}

/** Semana corrente: meta e fornos fechados, e o BM em andamento. */
export function semanaAtual(calc) {
  const c = curvaBm(calc);
  const fornosBat = FORNOS.filter((f) => f.bateria === contratoAtivo().bateria);
  return {
    semana: c.atual?.semana || semana(hoje()),
    meta: c.atual?.meta || 0,
    fechados: c.atual?.realizado || 0,
    bm: c,
    escopo: fornosBat.length,
    concluidos: fornosBat.filter((f) => calc.fornos[f.id].concluidoEm).length
  };
}

// ---------------------------------------------------------------------------
// RDO do dia montado a partir dos lançamentos e dos registros (5S, ocorrências)
// ---------------------------------------------------------------------------

/** Agrupa como no RDO: "B6 · F07 · LM · P01 P02 P03", "B6 · F07 · LM/LC". */
export function resumoAlvos(prims, etapaId) {
  const nivel = etapaPorId[etapaId].nivel;
  const porForno = new Map();
  for (const id of prims) {
    const p = primariaPorId[id];
    if (!p) continue;
    if (!porForno.has(p.fornoId)) porForno.set(p.fornoId, []);
    porForno.get(p.fornoId).push(p);
  }
  const linhas = [];
  const pn = (p) => `P${String(p.p).padStart(2, '0')}`;
  for (const [fid, ps] of [...porForno.entries()].sort()) {
    const nome = fid.replace('-', ' · ');
    const lados = ['LM', 'LC'].map((lado) => ps.filter((p) => p.lado === lado).sort((a, b) => a.p - b.p)).filter((l) => l.length);
    const ladoInteiro = (l) => l.length === 3 || nivel === 'cabeceira';
    if (nivel === 'forno' || ps.length === 6 || (nivel === 'cabeceira' && lados.length === 2)) linhas.push(`${nome} · LM/LC`);
    else for (const l of lados) linhas.push(ladoInteiro(l) ? `${nome} · ${l[0].lado}` : `${nome} · ${l[0].lado} · ${l.map(pn).join(' ')}`);
  }
  return linhas;
}

/** Primárias que tiveram a etapa concluída no dia, na bateria do contrato ativo. */
export function primariasDoDia(calc, data, etapaId) {
  const e = IDX[etapaId];
  const bat = contratoAtivo().bateria;
  return PRIMARIAS.filter((p) => p.bateria === bat && calc.feitas[p.idx][e] === data).map((p) => p.id);
}

export const rdoUltimo = (calc) => calc.estado.config?.rdoUltimo || RDO_ULTIMO;

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
  const ocorrencias = (calc.estado.ocorrencias || []).filter((o) => o.data === data && o.status !== 'cancelado').sort((a, b) => (a.criadoEmLocal || 0) - (b.criadoEmLocal || 0));
  const salvo = calc.estado.rdos[data] || null;
  const ultimo = rdoUltimo(calc);
  // até o último RDO da planilha, o relatório já foi emitido fora do app
  const status = salvo?.status || (data <= ultimo.data ? 'planilha' : 'rascunho');
  return { data, numero: salvo?.numero ?? numeroRdo(calc, data), atividades, materiais, ocorrencias, salvo, status };
}

/** Numeração continua a da planilha: um RDO por dia útil depois do último emitido. */
export function numeroRdo(calc, data) {
  const ultimo = rdoUltimo(calc);
  if (data <= ultimo.data) return null;
  let n = Number(ultimo.numero);
  for (let d = somarDias(ultimo.data, 1); d <= data; d = somarDias(d, 1)) if (diaUtil(d)) n++;
  return diaUtil(data) ? n : null;
}

/** Texto das observações do RDO montado a partir do que o campo registrou no dia. */
export function observacoesSugeridas(rdo) {
  const textos = rdo.ocorrencias.map((o) => o.texto.trim().replace(/\.$/, '')).filter(Boolean);
  if (!textos.length) return '';
  return `A REFRAMAX INFORMA QUE ${textos.join('; ').toUpperCase()}.`;
}

// ---------------------------------------------------------------------------
// Checklist de entrega: 8 fotos por forno (abóbada + 3 manilhas, em cada
// lado). O líder tira e envia; o planejador aprova e o número entra na
// medição. Os fornos que vieram da planilha entram aprovados, numerados na
// ordem em que os blocos fecharam e, dentro do bloco, pela ordem dos fornos.
// ---------------------------------------------------------------------------
export function checklists(calc) {
  const bat = contratoAtivo().bateria;
  const salvos = calc.estado.checklists || {};
  const concluidos = FORNOS.filter((f) => f.bateria === bat && calc.fornos[f.id].concluidoEm);
  const fimDoBloco = (bl) => concluidos.filter((f) => f.bloco === bl).map((f) => calc.fornos[f.id].concluidoEm).sort().pop();
  const daPlanilha = concluidos
    .filter((f) => !calc.fornos[f.id].fechouLanc && !salvos[f.id])
    .sort((a, b) => fimDoBloco(a.bloco).localeCompare(fimDoBloco(b.bloco)) || a.bloco.localeCompare(b.bloco) || a.forno - b.forno);
  const mapa = {};
  daPlanilha.forEach((f, i) => {
    mapa[f.id] = { numero: i + 1, status: 'aprovado', fotos: {}, nFotos: 0, origem: 'planilha', concluidoEm: calc.fornos[f.id].concluidoEm };
  });
  const comServico = FORNOS.filter((f) => f.bateria === bat && !mapa[f.id] && (salvos[f.id] || calc.fornos[f.id].niveis.some((n) => n >= I_MAPA.indexOf(IDX.injetbar))));
  for (const f of comServico) {
    const s = salvos[f.id] || {};
    const fotos = s.fotos || {};
    const nFotos = SLOTS_FOTO.filter((sl) => fotos[sl.id]).length;
    const status = ['aprovado', 'enviado', 'devolvido'].includes(s.status) ? s.status : nFotos ? 'rascunho' : 'pendente';
    mapa[f.id] = { ...s, status, fotos, nFotos, numero: s.numero || null, concluidoEm: calc.fornos[f.id].concluidoEm };
  }
  return mapa;
}

export const proximoNumeroChecklist = (calc) => Math.max(0, ...Object.values(checklists(calc)).map((c) => c.numero || 0)) + 1;

// ---------------------------------------------------------------------------
// Pessoas: XP, nível (em °C, até 1200 °C), sequência de dias e conquistas
// ---------------------------------------------------------------------------
export const XP_POR_PRIMARIA = 10;
export const XP_FORNO = 100;
export const XP_BLOCO = 500;
export const XP_CHECKLIST = 80;
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
  const checklistsEnviados = Object.values(calc.estado.checklists || {}).filter((c) => c.enviadoPorUid === uid && ['enviado', 'aprovado'].includes(c.status)).length;
  const xp = etapas * XP_POR_PRIMARIA + fornosFechados.length * XP_FORNO + blocosFechados.size * XP_BLOCO + checklistsEnviados * XP_CHECKLIST;
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
  const s = { uid, lancamentos: meus.length, etapas, hojeEtapas, fornos: fornosFechados.length, blocos: blocosFechados.size, checklists: checklistsEnviados, xp, sequencia: seq, dias: dias.size, pedidos, ...nivelDoXp(xp) };
  s.conquistas = CONQUISTAS.map((c) => ({ ...c, ganha: c.teste(s, calc) }));
  return s;
}

export const CONQUISTAS = [
  { id: 'faisca', nome: 'Primeira faísca', desc: 'Fez o primeiro lançamento', teste: (s) => s.lancamentos >= 1 },
  { id: 'forno', nome: 'Forno fechado', desc: 'Lançou a massa 1200 que fechou um forno', teste: (s) => s.fornos >= 1 },
  { id: 'fotografo', nome: 'Checklist na mão', desc: 'Enviou as 8 fotos de um forno', teste: (s) => s.checklists >= 1 },
  { id: 'dez-fornos', nome: 'Dez fornos', desc: 'Fechou 10 fornos', teste: (s) => s.fornos >= 10 },
  { id: 'bloco', nome: 'Bloco fechado', desc: 'Fechou o último forno de um bloco', teste: (s) => s.blocos >= 1 },
  { id: 'sequencia', nome: 'Cinco seguidos', desc: '5 dias úteis seguidos lançando', teste: (s) => s.sequencia >= 5 },
  { id: 'cem', nome: 'Cem etapas', desc: '100 etapas de primária lançadas', teste: (s) => s.etapas >= 100 },
  { id: 'mao-firme', nome: 'Mão firme', desc: '20 lançamentos sem pedir correção', teste: (s) => s.lancamentos >= 20 && s.pedidos === 0 },
  { id: 'brasa', nome: '1200 °C', desc: 'Chegou ao nível máximo', teste: (s) => s.nivel >= NIVEL_MAX }
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
  const c = new Array(I_MAPA.length + 1).fill(0); // índice 0 = pendente
  for (const p of PRIMARIAS) if (p.bateria === bat) c[calc.nivel[p.idx] + 1]++;
  return c;
}

/** Etapas feitas por dia (primária × etapa) num intervalo, separadas por etapa. */
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

/** Fornos concluídos agrupados por boletim de medição (pela semana em que fecharam). */
export function fornosPorBm(calc) {
  const bat = contratoAtivo().bateria;
  const grupos = {};
  for (const f of FORNOS) {
    const d = calc.fornos[f.id].concluidoEm;
    if (f.bateria !== bat || !d) continue;
    (grupos[bmDaSemana(d)] ||= []).push({ ...f, concluidoEm: d });
  }
  for (const g of Object.values(grupos)) g.sort((a, b) => a.concluidoEm.localeCompare(b.concluidoEm) || a.id.localeCompare(b.id));
  return grupos;
}

/** Relação da medição: fornos do BM (pela semana em que fecharam), na ordem do checklist. */
export function relacaoDoBm(calc, bmId) {
  const bat = contratoAtivo().bateria;
  const ck = checklists(calc);
  return FORNOS.filter((f) => f.bateria === bat && calc.fornos[f.id].concluidoEm && bmDaSemana(calc.fornos[f.id].concluidoEm) === bmId)
    .map((f) => ({ fid: f.id, bloco: f.bloco, forno: f.forno, concluidoEm: calc.fornos[f.id].concluidoEm, checklist: ck[f.id] || null }))
    .sort((a, b) => (a.checklist?.numero || 1e9) - (b.checklist?.numero || 1e9) || a.concluidoEm.localeCompare(b.concluidoEm) || a.fid.localeCompare(b.fid));
}

export { IDX as INDICE_ETAPA, N_ETAPAS, I_MAPA };
