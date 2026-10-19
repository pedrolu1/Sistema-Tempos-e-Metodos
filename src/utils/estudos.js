/**
 * Fórmulas dos estudos de Tempos e Métodos. Tudo aqui é cálculo puro (sem
 * DOM, sem Firebase) — as telas dos assistentes só coletam os dados e
 * mostram o que estas funções devolvem.
 */

/** Nível de confiança → coeficiente z da distribuição normal. */
export const CONFIANCAS = [
  { value: 0.9, label: '90%', z: 1.645 },
  { value: 0.95, label: '95%', z: 1.96 },
  { value: 0.99, label: '99%', z: 2.576 }
];
export const zDe = (confianca) => (CONFIANCAS.find((c) => c.value === Number(confianca)) || CONFIANCAS[1]).z;

/** Média, desvio-padrão amostral, mínimo, máximo, amplitude e coeficiente de variação. */
export function estatisticas(valores) {
  const xs = valores.map(Number).filter((v) => Number.isFinite(v) && v > 0);
  const n = xs.length;
  if (!n) return { n: 0, media: 0, desvio: 0, min: 0, max: 0, amplitude: 0, cv: 0 };
  const media = xs.reduce((s, v) => s + v, 0) / n;
  const desvio = n > 1 ? Math.sqrt(xs.reduce((s, v) => s + (v - media) ** 2, 0) / (n - 1)) : 0;
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  return { n, media, desvio, min, max, amplitude: max - min, cv: media ? desvio / media : 0 };
}

/** Percentil (0–1) por interpolação linear. */
export function percentil(valores, p) {
  const xs = valores.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const pos = (xs.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo);
}

/** Índices das leituras fora de média ± 2 desvios (candidatas a descarte). */
export function foraDaCurva(valores) {
  const { media, desvio, n } = estatisticas(valores);
  if (n < 4 || desvio === 0) return [];
  return valores.map((v, i) => (Math.abs(v - media) > 2 * desvio ? i : -1)).filter((i) => i >= 0);
}

/**
 * Número de ciclos necessário para a cronoanálise: N = (z · s / (Er · x̄))²,
 * com Er = erro relativo aceito (ex.: 0,05 = 5%).
 */
export function ciclosNecessarios(valores, confianca = 0.95, erro = 0.05) {
  const { n, media, desvio } = estatisticas(valores);
  if (n < 2 || !media) return 0;
  return Math.ceil(((zDe(confianca) * desvio) / (erro * media)) ** 2);
}

/**
 * Tolerâncias de referência (base OIT). `pct` é o padrão sugerido — o
 * analista liga/desliga e pode ajustar cada uma.
 */
export const TOLERANCIAS = [
  { key: 'pessoais', label: 'Necessidades pessoais', pct: 5, padrao: true },
  { key: 'fadiga', label: 'Fadiga básica', pct: 4, padrao: true },
  { key: 'emPe', label: 'Trabalho em pé', pct: 2, padrao: true },
  { key: 'posicao', label: 'Posição incômoda (curvado, agachado)', pct: 2, padrao: false },
  { key: 'forca', label: 'Esforço / carga pesada', pct: 3, padrao: false },
  { key: 'calor', label: 'Calor intenso (coqueria, alto-forno)', pct: 5, padrao: false },
  { key: 'ruido', label: 'Ruído intenso', pct: 2, padrao: false },
  { key: 'epi', label: 'EPI pesado (roupa aluminizada, máscara)', pct: 2, padrao: false },
  { key: 'atencao', label: 'Atenção / precisão elevada', pct: 2, padrao: false }
];

export function toleranciasPadrao() {
  return Object.fromEntries(TOLERANCIAS.map((t) => [t.key, { ativo: t.padrao, pct: t.pct }]));
}

/** Soma (em fração) das tolerâncias ligadas. */
export function somaTolerancias(sel = {}) {
  return TOLERANCIAS.reduce((s, t) => s + (sel[t.key]?.ativo ? Number(sel[t.key].pct) || 0 : 0), 0) / 100;
}

/** Fator de tolerância: FT = 1 / (1 − p), p = tolerância em fração da jornada. */
export function fatorTolerancia(p) {
  const frac = Math.min(Math.max(Number(p) || 0, 0), 0.9);
  return 1 / (1 - frac);
}

/**
 * Cronoanálise completa a partir das leituras (segundos por ciclo):
 *   TC = média dos ciclos válidos
 *   TN = TC × FR (fator de ritmo)
 *   TP = TN × FT (fator de tolerância)
 * Devolve também o tempo da etapa inteira quando há quantidade.
 */
export function cronoanalise({ leituras = [], descartadas = [], ritmo = 1, tolerancias = {}, confianca = 0.95, erro = 0.05, quantidade = 0 }) {
  const validas = leituras.filter((_, i) => !descartadas.includes(i));
  const est = estatisticas(validas);
  const p = somaTolerancias(tolerancias);
  const ft = fatorTolerancia(p);
  const tc = est.media;
  const tn = tc * (Number(ritmo) || 1);
  const tp = tn * ft;
  const qtd = Number(quantidade) || 0;
  return {
    ...est,
    tc,
    tn,
    tp,
    fr: Number(ritmo) || 1,
    ft,
    tolerancia: p,
    necessarios: ciclosNecessarios(validas, confianca, erro),
    etapaMin: qtd > 0 ? (tp * qtd) / 60 : 0,
    pecasHora: tp > 0 ? 3600 / tp : 0
  };
}

/**
 * Amostragem do trabalho: proporção de cada categoria, erro atual (em pontos
 * percentuais) e nº de observações necessário para a margem pedida:
 *   n = z² · p · (1 − p) / e²   (p = proporção da categoria principal)
 */
export function amostragem({ contagens = {}, principal, confianca = 0.95, erro = 0.05 }) {
  const total = Object.values(contagens).reduce((s, v) => s + (Number(v) || 0), 0);
  const z = zDe(confianca);
  const props = Object.fromEntries(Object.entries(contagens).map(([k, v]) => [k, total ? (Number(v) || 0) / total : 0]));
  const p = props[principal] ?? 0;
  const pCalc = total ? p : 0.5; // sem dados, usa o pior caso (0,5)
  return {
    total,
    proporcoes: props,
    p,
    erroAtual: total ? z * Math.sqrt((p * (1 - p)) / total) : 1,
    necessarias: Math.ceil((z ** 2 * pCalc * (1 - pCalc)) / (Number(erro) || 0.05) ** 2)
  };
}

/** Takt time = tempo disponível ÷ demanda (mesma unidade de tempo do disponível). */
export function taktTime(disponivelMin, demanda) {
  const d = Number(demanda) || 0;
  return d > 0 ? (Number(disponivelMin) || 0) / d : 0;
}

/** 1 TMU = 0,00001 h = 0,036 s. */
export const TMU_SEG = 0.036;

/**
 * Biblioteca de referência MTM-1 (valores em TMU). As distâncias foram
 * convertidas das tabelas em polegadas (4" ≈ 10 cm, 10" ≈ 25 cm, 20" ≈ 50
 * cm, 30" ≈ 75 cm). Para pesos acima de ~1 kg o MTM aplica fatores extras
 * — nesses casos use um elemento personalizado.
 */
export const MTM_BIBLIOTECA = [
  { grupo: 'Alcançar (R)', itens: [
    { cod: 'R10A', nome: 'Alcançar objeto em local fixo — 10 cm', tmu: 6.1 },
    { cod: 'R25A', nome: 'Alcançar objeto em local fixo — 25 cm', tmu: 8.7 },
    { cod: 'R50A', nome: 'Alcançar objeto em local fixo — 50 cm', tmu: 13.1 },
    { cod: 'R75A', nome: 'Alcançar objeto em local fixo — 75 cm', tmu: 17.5 },
    { cod: 'R25B', nome: 'Alcançar objeto em local variável — 25 cm', tmu: 11.5 },
    { cod: 'R50B', nome: 'Alcançar objeto em local variável — 50 cm', tmu: 18.6 },
    { cod: 'R25C', nome: 'Alcançar objeto misturado/em pilha — 25 cm', tmu: 12.9 },
    { cod: 'R50C', nome: 'Alcançar objeto misturado/em pilha — 50 cm', tmu: 19.8 }
  ] },
  { grupo: 'Agarrar (G)', itens: [
    { cod: 'G1A', nome: 'Pegar objeto fácil, isolado', tmu: 2.0 },
    { cod: 'G1B', nome: 'Pegar objeto pequeno/plano', tmu: 3.5 },
    { cod: 'G1C1', nome: 'Pegar objeto cilíndrico com interferência', tmu: 7.3 },
    { cod: 'G2', nome: 'Reagarrar (ajustar a pegada)', tmu: 5.6 },
    { cod: 'G3', nome: 'Passar o objeto de uma mão para a outra', tmu: 5.6 },
    { cod: 'G4A', nome: 'Escolher e pegar em pilha (objeto grande)', tmu: 7.3 },
    { cod: 'G4B', nome: 'Escolher e pegar em pilha (objeto médio)', tmu: 9.1 },
    { cod: 'G4C', nome: 'Escolher e pegar em pilha (objeto pequeno)', tmu: 12.9 }
  ] },
  { grupo: 'Mover (M)', itens: [
    { cod: 'M10A', nome: 'Mover até um batente/outra mão — 10 cm', tmu: 6.1 },
    { cod: 'M25A', nome: 'Mover até um batente/outra mão — 25 cm', tmu: 11.3 },
    { cod: 'M50A', nome: 'Mover até um batente/outra mão — 50 cm', tmu: 19.2 },
    { cod: 'M25B', nome: 'Mover para local aproximado — 25 cm', tmu: 12.2 },
    { cod: 'M50B', nome: 'Mover para local aproximado — 50 cm', tmu: 18.2 },
    { cod: 'M25C', nome: 'Mover para local exato — 25 cm', tmu: 13.5 },
    { cod: 'M50C', nome: 'Mover para local exato — 50 cm', tmu: 22.1 },
    { cod: 'M75C', nome: 'Mover para local exato — 75 cm', tmu: 30.7 }
  ] },
  { grupo: 'Posicionar (P)', itens: [
    { cod: 'P1SE', nome: 'Encaixe folgado, simétrico, fácil', tmu: 5.6 },
    { cod: 'P1SD', nome: 'Encaixe folgado, simétrico, difícil', tmu: 11.2 },
    { cod: 'P2SE', nome: 'Encaixe justo, simétrico, fácil', tmu: 16.2 },
    { cod: 'P2SD', nome: 'Encaixe justo, simétrico, difícil', tmu: 21.8 },
    { cod: 'P3SE', nome: 'Encaixe exato (pressão leve), fácil', tmu: 43.0 }
  ] },
  { grupo: 'Soltar, girar e pressionar', itens: [
    { cod: 'RL1', nome: 'Soltar abrindo os dedos', tmu: 2.0 },
    { cod: 'T45S', nome: 'Girar o punho 45° (peça leve)', tmu: 3.5 },
    { cod: 'T90S', nome: 'Girar o punho 90° (peça leve)', tmu: 5.4 },
    { cod: 'T180S', nome: 'Girar o punho 180° (peça leve)', tmu: 9.4 },
    { cod: 'APA', nome: 'Aplicar pressão (com reagarre)', tmu: 10.6 },
    { cod: 'APB', nome: 'Aplicar pressão (sem reagarre)', tmu: 16.2 },
    { cod: 'D1E', nome: 'Desencaixar folgado, fácil', tmu: 4.0 },
    { cod: 'D2E', nome: 'Desencaixar justo, fácil', tmu: 7.5 }
  ] },
  { grupo: 'Corpo e olhos', itens: [
    { cod: 'W-P', nome: 'Andar — por passo', tmu: 15.0 },
    { cod: 'B', nome: 'Curvar-se', tmu: 29.0 },
    { cod: 'AB', nome: 'Levantar-se da curvatura', tmu: 31.9 },
    { cod: 'KBK', nome: 'Ajoelhar com os dois joelhos', tmu: 69.4 },
    { cod: 'AKBK', nome: 'Levantar dos dois joelhos', tmu: 76.7 },
    { cod: 'SIT', nome: 'Sentar', tmu: 34.7 },
    { cod: 'STD', nome: 'Levantar da posição sentada', tmu: 43.4 },
    { cod: 'TBC1', nome: 'Girar o corpo (um passo)', tmu: 18.6 },
    { cod: 'FM', nome: 'Movimento do pé', tmu: 8.5 },
    { cod: 'EF', nome: 'Focalizar com os olhos', tmu: 7.3 }
  ] }
];

/** Soma dos elementos MTM (TMU × frequência) e conversão para segundos. */
export function mtmTotal(elementos = []) {
  const tmu = elementos.reduce((s, e) => s + (Number(e.tmu) || 0) * (Number(e.freq) || 0), 0);
  return { tmu, seg: tmu * TMU_SEG };
}

/** Formata segundos de forma legível: "48,3 s" ou "2 min 05 s". */
export function formatSeg(seg) {
  const s = Math.max(0, Number(seg) || 0);
  if (s < 60) return `${s.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  if (m < 60) return `${m} min ${String(r).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

export const pct = (v, casas = 0) => `${((Number(v) || 0) * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`;
export const num = (v, casas = 2) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });
